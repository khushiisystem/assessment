import os
import sys
import uuid
from pathlib import Path

p = Path('temp_resume.pdf')
contents = b'%PDF-1.4\n1 0 obj<<>>\nendobj\n2 0 obj<< /Type /Catalog /Pages 3 0 R>>\nendobj\n3 0 obj<< /Type /Pages /Kids [4 0 R] /Count 1>>\nendobj\n4 0 obj<< /Type /Page /Parent 3 0 R /MediaBox [0 0 200 200] /Contents 5 0 R /Resources << /ProcSet [/PDF /Text] /Font << /F1 6 0 R >> >> >>\nendobj\n5 0 obj<< /Length 44>>\nstream\nBT /F1 24 Tf 50 150 Td (Hello World) Tj ET\nendstream\nendobj\n6 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica>>\nendobj\nxref\n0 7\n0000000000 65535 f \n0000000010 00000 n \n0000000067 00000 n \n0000000120 00000 n \n0000000202 00000 n \n0000000346 00000 n \n0000000430 00000 n \ntrailer<< /Root 1 0 R /Size 7>>\nstartxref\n498\n%%EOF\n'
p.write_bytes(contents)
print('created', p)
url = 'http://127.0.0.1:8000/v1/api/interview/parse-resume/'
try:
    import requests
except ImportError:
    requests = None

if requests:
    with open(p, 'rb') as f:
        r = requests.post(url, files={'resume': ('resume.pdf', f, 'application/pdf')})
    print('status', r.status_code)
    print('text', r.text)
else:
    import urllib.request
    import mimetypes
    boundary = '----WebKitFormBoundary' + uuid.uuid4().hex
    data = []
    data.append('--' + boundary)
    data.append('Content-Disposition: form-data; name="resume"; filename="resume.pdf"')
    data.append('Content-Type: application/pdf\r\n')
    body = b'\r\n'.join(x.encode() if isinstance(x, str) else x for x in data) + p.read_bytes() + b'\r\n--' + boundary.encode() + b'--\r\n'
    req = urllib.request.Request(url, data=body, headers={'Content-Type': 'multipart/form-data; boundary=' + boundary})
    try:
        resp = urllib.request.urlopen(req)
        print('status', resp.getcode())
        print(resp.read().decode('utf-8', errors='replace'))
    except Exception as e:
        print('ERROR', type(e).__name__, e)
