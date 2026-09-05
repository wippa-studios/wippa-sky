#!/bin/bash
cd /home/Joel/Desktop/wippa-sky
python3 -m http.server 3001 &>/dev/null &
sleep 0.5
xdg-open http://localhost:3001
