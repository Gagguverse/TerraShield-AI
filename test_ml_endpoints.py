import urllib.request, json

# Test 1: GET /api/thermal/status
r = urllib.request.urlopen('http://127.0.0.1:8000/api/thermal/status')
s = json.loads(r.read())
print('=== GET /api/thermal/status ===')
print('ML Model:', s['ml_model']['name'], '|', s['ml_model']['status'])

# Test 2: POST /api/thermal/analyze (U-Net)
req = urllib.request.Request('http://127.0.0.1:8000/api/thermal/analyze',
    data=json.dumps({'image_source':'sample_lwir','confidence_threshold':0.1}).encode(),
    headers={'Content-Type':'application/json'})
r = urllib.request.urlopen(req)
u = json.loads(r.read())
print()
print('=== POST /api/thermal/analyze ===')
print('Status:', u['status'], '| Model:', u['model_name'])
print('Latency:', u['inference_latency_ms'], 'ms')
print('Hot pixel fraction:', u.get('hot_pixel_fraction'))
print('Hot pixel count:', u.get('hot_pixel_count'))
print('Mask URL:', u.get('mask_url'))
print('Val Dice:', u.get('val_dice'), '| Val IoU:', u.get('val_iou'))
print('Detections count:', u['detections_count'])
print('Disclaimer (first 100):', u['disclaimer'][:100])

# Test 3: POST /api/fire/detect (YOLO)
req = urllib.request.Request('http://127.0.0.1:8000/api/fire/detect',
    data=json.dumps({'image_source':'sample_lwir','confidence_threshold':0.25}).encode(),
    headers={'Content-Type':'application/json'})
r = urllib.request.urlopen(req)
y = json.loads(r.read())
print()
print('=== POST /api/fire/detect ===')
print('Status:', y['status'], '| Model:', y['model_name'])
print('Latency:', y['inference_latency_ms'], 'ms')
print('Detection count:', y['detection_count'])
print('Annotated URL:', y.get('annotated_image_url'))
for d in y['detections']:
    print(f"  {d['label']:6s} conf={d['confidence']:.3f}  box={d['box']}")
print('Disclaimer (first 100):', y['disclaimer'][:100])

# Test 4: Viz endpoint
if u.get('mask_url'):
    r = urllib.request.urlopen('http://127.0.0.1:8000' + u['mask_url'])
    print()
    print('=== Mask viz fetch ===')
    print('Status:', r.status, '| Size:', len(r.read()), 'bytes')
if y.get('annotated_image_url'):
    r = urllib.request.urlopen('http://127.0.0.1:8000' + y['annotated_image_url'])
    print('=== YOLO viz fetch ===')
    print('Status:', r.status, '| Size:', len(r.read()), 'bytes')

print()
print('ALL BACKEND TESTS PASSED')
