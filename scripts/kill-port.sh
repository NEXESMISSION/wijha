#!/bin/bash
# Bash script to kill process on port 3000 (Unix/Linux/Mac)

PORT=3000
PID=$(lsof -ti:$PORT)

if [ -z "$PID" ]; then
    echo "No process found on port $PORT"
else
    echo "Killing process $PID on port $PORT"
    kill -9 $PID
    echo "Port $PORT is now free"
fi

