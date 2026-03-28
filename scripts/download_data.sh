#!/bin/bash
# Download Instacart Market Basket Analysis dataset
# Source: https://www.kaggle.com/datasets/psparks/instacart-market-basket-analysis
#
# Prerequisites: kaggle CLI (pip install kaggle) with API key configured
# Alternative: Download manually from Kaggle and extract to ../data/

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DATA_DIR="$SCRIPT_DIR/../data"

mkdir -p "$DATA_DIR"

echo "=== Instacart Dataset Downloader ==="
echo "Target directory: $DATA_DIR"
echo ""

# Check if data already exists
if [ -f "$DATA_DIR/orders.csv" ] && [ -f "$DATA_DIR/order_products__prior.csv" ]; then
    echo "Data files already exist in $DATA_DIR"
    echo "Delete them first if you want to re-download."
    exit 0
fi

# Try kaggle CLI first
if command -v kaggle &> /dev/null; then
    echo "Downloading via Kaggle CLI..."
    kaggle datasets download -d psparks/instacart-market-basket-analysis -p "$DATA_DIR" --unzip
    echo "Download complete!"
else
    echo "Kaggle CLI not found."
    echo ""
    echo "Option 1: Install kaggle CLI"
    echo "  pip install kaggle"
    echo "  # Set up ~/.kaggle/kaggle.json with your API key"
    echo "  # Then re-run this script"
    echo ""
    echo "Option 2: Manual download"
    echo "  1. Go to: https://www.kaggle.com/datasets/psparks/instacart-market-basket-analysis"
    echo "  2. Download and extract all CSV files to: $DATA_DIR"
    echo ""
    echo "Required files:"
    echo "  - orders.csv"
    echo "  - order_products__prior.csv"
    echo "  - order_products__train.csv"
    echo "  - products.csv"
    echo "  - aisles.csv"
    echo "  - departments.csv"
    exit 1
fi

# Verify files
echo ""
echo "Verifying downloaded files..."
REQUIRED_FILES=("orders.csv" "order_products__prior.csv" "order_products__train.csv" "products.csv" "aisles.csv" "departments.csv")
ALL_GOOD=true

for f in "${REQUIRED_FILES[@]}"; do
    if [ -f "$DATA_DIR/$f" ]; then
        SIZE=$(du -h "$DATA_DIR/$f" | cut -f1)
        echo "  ✓ $f ($SIZE)"
    else
        echo "  ✗ $f MISSING"
        ALL_GOOD=false
    fi
done

if $ALL_GOOD; then
    echo ""
    echo "All files downloaded successfully!"
else
    echo ""
    echo "Some files are missing. Check the download."
    exit 1
fi
