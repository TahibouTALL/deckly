@echo off
rem Starts Deckly and opens it in your browser.
cd /d "%~dp0"
start "" http://localhost:5179
node server.js
