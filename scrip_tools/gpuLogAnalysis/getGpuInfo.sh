#!/bin/bash
fileName=$(date +%Y%m%d%H%M)"-gpu.log";
for i in `seq 1 120`;
do nvidia-smi>>${fileName};
sleep 60s;
done