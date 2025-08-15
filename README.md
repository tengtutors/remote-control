# Remote Control (WebRTC)

- One Node app serves the website **and** hosts WebSocket signaling on `/socket`.
- Host: shares screen; Viewer: sees screen and sends control inputs via WebRTC data channel.
- For real OS control, the Host can optionally run a local Python helper (below).

## Optional local helper (Host machine)
Save as `helper.py` and run on the Host (`pip install websockets pynput screeninfo`), then uncomment the helper WebSocket line in `web/index.html`.

```python
import asyncio, json, websockets
from pynput.mouse import Controller as Mouse, Button
from pynput.keyboard import Controller as Keyboard, Key
import screeninfo

mouse, keyboard = Mouse(), Keyboard()
try:
    m = screeninfo.get_monitors()[0]; W, H = m.width, m.height
except: W, H = 1920, 1080

async def handle(ws):
    async for msg in ws:
        try: data = json.loads(msg)
        except: continue
        if data.get("type") == "mouse":
            k = data.get("kind")
            if k == "move":
                x = max(0,min(1,float(data.get("x",0))))*W
                y = max(0,min(1,float(data.get("y",0))))*H
                mouse.position = (int(x), int(y))
            elif k in ("down","up"):
                btn = {0: Button.left, 1: Button.middle, 2: Button.right}.get(data.get("button",0), Button.left)
                (mouse.press if k=="down" else mouse.release)(btn)
            elif k == "wheel":
                mouse.scroll(int(data.get("deltaX",0)), int(data.get("deltaY",0)))
        elif data.get("type") == "key":
            k = data.get("key"); kind = data.get("kind")
            if len(k) == 1:
                (keyboard.press if kind=="down" else keyboard.release)(k)
            else:
                mp = {"Enter":Key.enter,"Backspace":Key.backspace,"Tab":Key.tab,"Escape":Key.esc,
                      "Shift":Key.shift,"Control":Key.ctrl,"Alt":Key.alt,"Meta":Key.cmd,
                      "ArrowUp":Key.up,"ArrowDown":Key.down,"ArrowLeft":Key.left,"ArrowRight":Key.right}
                kk = mp.get(k)
                if kk: (keyboard.press if kind=="down" else keyboard.release)(kk)

async def main():
    async with websockets.serve(handle, "127.0.0.1", 8765):
        print("Helper on ws://127.0.0.1:8765"); await asyncio.Future()

if __name__ == "__main__":
    asyncio.run(main())
```

### Usage

Host opens the site, enters a 6-digit code, clicks Host (Share Screen), picks a screen.

Viewer opens the same site, enters the same code, clicks Viewer (Control).

For real OS control, run helper.py locally on Host and uncomment the helper line in index.html.
