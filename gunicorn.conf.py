import os
bind = os.getenv('GUNICORN_BIND', '127.0.0.1:8000')
workers = int(os.getenv('GUNICORN_WORKERS', '2'))
timeout = 60
accesslog = '-'
errorlog = '-'
# O proxy deve preservar Host e encaminhar HTTPS; não confie em X-Forwarded-For arbitrário.
