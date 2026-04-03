#!/bin/bash
# Claude Code 一键启动脚本

cd /home/tzp/work/agent/my_test
exec /home/tzp/work/agent/MAi_Coding/bun-linux-x64/bun --env-file=.env ./src/entrypoints/cli.tsx
