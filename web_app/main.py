from fastapi import FastAPI, HTTPException, Query, Depends, Security
from fastapi.security import APIKeyHeader
from fastapi.responses import FileResponse
from datetime import datetime
from typing import Optional
from colmi_r02_client.client import Client
from colmi_r02_client.real_time import REAL_TIME_MAPPING
from colmi_r02_client import hr, steps
from dotenv import load_dotenv
import os

load_dotenv()

API_KEY = os.getenv("API_KEY")
API_KEY_NAME = "X-API-Key"

api_key_header = APIKeyHeader(name=API_KEY_NAME, auto_error=True)

async def get_api_key(api_key: str = Security(api_key_header)):
    if api_key == API_KEY:
        return api_key
    else:
        raise HTTPException(status_code=403, detail="Could not validate credentials")

app = FastAPI()

@app.get("/")
async def read_index():
    return FileResponse('web_app/templates/index.html')

@app.get("/static/{file_path:path}")
async def static_files(file_path: str):
    return FileResponse(f'web_app/static/{file_path}')

async def get_client(address: str) -> Client:
    return Client(address)

@app.get("/api_key")
async def get_key():
    return {"api_key": API_KEY}


@app.get("/scan", dependencies=[Depends(get_api_key)])
async def scan_devices():
    from bleak import BleakScanner
    devices = await BleakScanner.discover()
    return [{"name": d.name, "address": d.address} for d in devices]

@app.get("/{address}/info", dependencies=[Depends(get_api_key)])
async def get_info(address: str):
    async with await get_client(address) as client:
        info = await client.get_device_info()
        battery = await client.get_battery()
        return {"device_info": info, "battery": battery}

@app.get("/{address}/heart_rate_log", dependencies=[Depends(get_api_key)])
async def get_heart_rate_log(address: str, target_date: Optional[str] = None):
    target = datetime.strptime(target_date, "%Y-%m-%d") if target_date else datetime.now()
    async with await get_client(address) as client:
        log = await client.get_heart_rate_log(target)
        if isinstance(log, hr.HeartRateLog):
            return {
                "raw": log,
                "chart_data": log.heart_rates_with_times()
            }
        return log

@app.post("/{address}/time", dependencies=[Depends(get_api_key)])
async def set_time(address: str, time: Optional[str] = None):
    try:
        when = datetime.fromisoformat(time) if time else datetime.now()
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid time format. Use ISO 8601 format.")
    async with await get_client(address) as client:
        await client.set_time(when)
        return {"status": "Time set successfully"}

@app.get("/{address}/heart_rate_log_settings", dependencies=[Depends(get_api_key)])
async def get_heart_rate_log_settings(address: str):
    async with await get_client(address) as client:
        return await client.get_heart_rate_log_settings()

@app.post("/{address}/heart_rate_log_settings", dependencies=[Depends(get_api_key)])
async def set_heart_rate_log_settings(address: str, enable: bool, interval: int = 60):
    async with await get_client(address) as client:
        await client.set_heart_rate_log_settings(enable, interval)
        return {"status": "Heart rate log settings updated"}

@app.get("/{address}/real_time_reading", dependencies=[Depends(get_api_key)])
async def get_real_time_reading(address: str, reading: str):
    if reading not in REAL_TIME_MAPPING:
        raise HTTPException(status_code=400, detail="Invalid reading type")
    reading_type = REAL_TIME_MAPPING[reading]
    async with await get_client(address) as client:
        result = await client.get_realtime_reading(reading_type)
        if result:
            return {"reading": result}
        else:
            raise HTTPException(status_code=500, detail=f"Error, no {reading.replace('-', ' ')} detected. Is the ring being worn?")

@app.get("/{address}/steps", dependencies=[Depends(get_api_key)])
async def get_steps(address: str, when: Optional[str] = None):
    target_date = datetime.strptime(when, "%Y-%m-%d") if when else datetime.now()
    async with await get_client(address) as client:
        result = await client.get_steps(target_date)
        if isinstance(result, steps.NoData):
            return result
        return [s.__dict__ for s in result]


@app.post("/{address}/reboot", dependencies=[Depends(get_api_key)])
async def reboot_device(address: str):
    async with await get_client(address) as client:
        await client.reboot()
        return {"status": "Ring rebooted"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=5004)