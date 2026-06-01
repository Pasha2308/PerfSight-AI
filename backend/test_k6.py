import asyncio
from executors.real_executors import K6Executor

async def run():
    exc = K6Executor()
    async def on_metric(m):
        print('metric:', m)
    
    scenario = {'load_parameters':{'steady_state_duration_sec': 5, 'ramp_up_duration_sec': 0, 'ramp_down_duration_sec': 0}}
    script = 'import http from "k6/http";\nexport default function() { http.get("http://localhost:8000/api/health"); }'
    
    print("starting k6 run")
    await exc.run(scenario, script, on_metric)
    print("finished k6 run")

if __name__ == "__main__":
    asyncio.run(run())
