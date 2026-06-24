from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

app = FastAPI()

app.mount('/static', StaticFiles(directory='ERPFiat-Portatil/resources'), name='static')

@app.get('/')
async def root():
    return FileResponse('ERPFiat-Portatil/resources/hub/hub.html')

@app.get('/health')
async def health():
    return {'status': 'ok'}

