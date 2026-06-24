from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import os

app = FastAPI()

# Serve os arquivos estaticos do frontend
app.mount('/static', StaticFiles(directory='ERPFiat-Portatil/resources'), name='static')

@app.get('/')
async def root():
    return FileResponse('ERPFiat-Portatil/resources/hub/hub.html')

@app.get('/health')
async def health():
    return {'status': 'ok'}

# Captura o usuario logado via Azure AD
@app.middleware('http')
async def add_user(request: Request, call_next):
    user = request.headers.get('X-Forwarded-User', 'local-dev')
    request.state.user = user
    response = await call_next(request)
    return response
