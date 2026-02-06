#!/bin/bash

echo ""
echo "  IG-X Downloader - Setup"
echo "  ========================"
echo ""

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "  [!] Node.js not found."
    echo "  Please install Node.js from https://nodejs.org"
    echo ""
    exit 1
fi
echo "  [OK] Node.js $(node -v)"

# Check Python/pip
if command -v pip3 &> /dev/null; then
    PIP="pip3"
elif command -v pip &> /dev/null; then
    PIP="pip"
else
    echo "  [!] pip not found."
    echo "  Please install Python from https://python.org"
    echo ""
    exit 1
fi
echo "  [OK] pip found"

# Install gallery-dl
echo ""
echo "  Installing gallery-dl..."
$PIP install gallery-dl
if [ $? -eq 0 ]; then
    echo "  [OK] gallery-dl installed"
else
    echo "  [!] Failed to install gallery-dl. Try: sudo pip install gallery-dl"
fi

# Install Node dependencies
echo ""
echo "  Installing Node dependencies..."
npm install
echo "  [OK] Dependencies installed"

echo ""
echo "  ========================"
echo "  Setup complete!"
echo ""
echo "  To start: npm start"
echo "  Then open: http://localhost:3000"
echo ""
