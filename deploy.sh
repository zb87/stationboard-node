#!/bin/bash

git pull
npm install
npm run web:build
sudo systemctl restart stationboard-node