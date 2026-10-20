"""Unit tests for TinyFish search/fetch adapter."""

import asyncio
from unittest.mock import AsyncMock, patch
import httpx
import pytest

from backend.adapters.tinyfish_adapter import TinyFishAdapter
from backend.models.evidence import SourceType


def test_classify_source_authority():
    adapter = TinyFishAdapter()

    # Official government emergency domains
    src_type, is_official, dom = adapter.classify_source(
        "https://wildfiresituation.nrs.gov.bc.ca/incidents", "BC Wildfire Service", "Fire update"
    )
    assert src_type == SourceType.OFFICIAL_AGENCY
    assert is_official is True

    src_type, is_official, dom = adapter.classify_source(
        "https://inciweb.wildfire.gov/incident-information/wawfd-tunnel-5", "InciWeb", "Tunnel 5 Fire"
    )
    assert src_type == SourceType.OFFICIAL_AGENCY
    assert is_official is True

    # News Media domains
    src_type, is_official, dom = adapter.classify_source(
        "https://www.cbc.ca/news/canada/british-columbia/bc-wildfires", "CBC News", "Fire spreads"
    )
    assert src_type == SourceType.NEWS_MEDIA
    assert is_official is False

    # Unverified / generic domain
    src_type, is_official, dom = adapter.classify_source(
        "https://myblogsite.com/fire-thoughts", "Personal Blog", "Smoke today"
    )
    assert src_type == SourceType.UNVERIFIED
    assert is_official is False


def test_relevance_calculation():
    adapter = TinyFishAdapter()
    score, explanation = adapter.calculate_relevance(
        title="Donnie Creek wildfire out of control",
        snippet="Peace River Regional District evacuation orders issued for northern BC.",
        target_location="Peace River",
        target_date="2023-07-12",
    )
    assert score >= 0.7
    assert "wildfire keywords" in explanation
    assert "Peace River" in explanation


def test_search_without_credentials_returns_truthful_state():
    adapter = TinyFishAdapter(api_key="")
    assert adapter.is_configured is False

    results, message = asyncio.run(adapter.search("wildfire reports"))
    assert len(results) == 0
    assert message is not None
    assert "TINYFISH_API_KEY is not configured" in message
    assert "https://www.tinyfish.ai/" in message


def test_search_and_fetch_mock_pipeline():
    adapter = TinyFishAdapter(api_key="mock_tf_key_test_12345")
    assert adapter.is_configured is True

    search_response_payload = {
        "results": [
            {
                "url": "https://wildfiresituation.nrs.gov.bc.ca/incident-101",
                "title": "Donnie Creek Wildfire Situation Update",
                "snippet": "BC Wildfire Service responding to lightning-caused blaze in Peace Region.",
                "site_name": "BC Wildfire Service",
            },
            {
                "url": "https://www.cbc.ca/news/canada/bc-fire-evacuations",
                "title": "Evacuation order issued for rural properties near highway",
                "snippet": "Heavy smoke visible across northern British Columbia.",
                "site_name": "CBC News",
            },
        ]
    }

    fetch_response_payload = [
        {
            "url": "https://wildfiresituation.nrs.gov.bc.ca/incident-101",
            "content": "# BC Wildfire Incident 101\nFull evacuation order issued for Area B.\nCurrent size: 12,000 hectares.",
        }
    ]

    mock_search_resp = httpx.Response(
        status_code=200,
        json=search_response_payload,
        request=httpx.Request("GET", adapter.search_url),
    )
    mock_fetch_resp = httpx.Response(
        status_code=200,
        json=fetch_response_payload,
        request=httpx.Request("POST", adapter.fetch_url),
    )

    async def mock_async_client_call(*args, **kwargs):
        # We can mock get and post separately
        pass

    with patch("httpx.AsyncClient.get", new_callable=AsyncMock) as mock_get:
        mock_get.return_value = mock_search_resp
        with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
            mock_post.return_value = mock_fetch_resp

            records, msg, status = asyncio.run(
                adapter.search_and_fetch(
                    query="Donnie Creek wildfire BC",
                    target_location="Peace Region",
                    do_fetch=True,
                )
            )

            assert status == "success"
            assert len(records) == 2
            # First item from official domain
            assert records[0].source_type == SourceType.OFFICIAL_AGENCY
            assert records[0].is_official is True
            assert records[0].full_text is not None
            assert "12,000 hectares" in records[0].full_text
            assert records[0].url == "https://wildfiresituation.nrs.gov.bc.ca/incident-101"

            # Second item from news domain
            assert records[1].source_type == SourceType.NEWS_MEDIA
            assert records[1].is_official is False
            assert "CBC News" in records[1].source_name


def test_search_and_fetch_rate_limited():
    adapter = TinyFishAdapter(api_key="mock_tf_key_test_12345")
    mock_resp = httpx.Response(
        status_code=429,
        text="Rate limit exceeded",
        request=httpx.Request("GET", adapter.search_url),
    )

    with patch("httpx.AsyncClient.get", new_callable=AsyncMock) as mock_get:
        mock_get.return_value = mock_resp
        records, msg, status = asyncio.run(adapter.search_and_fetch("test query"))
        assert status == "rate_limited"
        assert len(records) == 0
        assert "rate limit exceeded" in msg


def test_search_and_fetch_partial_failure():
    """Search succeeds, but Fetch fails/times out. Snippets are still safely preserved."""
    adapter = TinyFishAdapter(api_key="mock_tf_key_test_12345")

    search_payload = {
        "results": [
            {
                "url": "https://www.cbc.ca/news/smoke-warning",
                "title": "Air Quality Alert Issued",
                "snippet": "Smoke from remote blazes drifting into metro valley.",
                "site_name": "CBC News",
            }
        ]
    }

    mock_search_resp = httpx.Response(
        status_code=200,
        json=search_payload,
        request=httpx.Request("GET", adapter.search_url),
    )

    with patch("httpx.AsyncClient.get", new_callable=AsyncMock) as mock_get:
        mock_get.return_value = mock_search_resp
        with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
            # Simulate fetch failure (e.g. 500 error or connection error)
            mock_post.side_effect = httpx.ConnectError("Connection refused by upstream")

            records, msg, status = asyncio.run(
                adapter.search_and_fetch("smoke warning", do_fetch=True)
            )

            # Search still succeeded and returned records with snippet
            assert status == "success"
            assert len(records) == 1
            assert records[0].title == "Air Quality Alert Issued"
            assert records[0].full_text is None
