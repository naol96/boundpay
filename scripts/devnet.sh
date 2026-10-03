#!/usr/bin/env bash
#
# BoundPay — Local Devnet Validator Manager
# Canonical ephemeral validator matching v3 specs (Section 5.3)
#

set -e

LEDGER_DIR="$HOME/.config/solana/test-ledger"
PID_FILE="$HOME/.config/solana/test-ledger/validator.pid"
LOG_FILE="$HOME/.config/solana/test-ledger/validator.log"
RPC_URL="http://127.0.0.1:8899"

start() {
  if [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
    echo "Local Devnet is already running (PID: $(cat "$PID_FILE"))."
    exit 0
  fi

  echo "Starting BoundPay Local Devnet Validator..."
  mkdir -p "$LEDGER_DIR"

  nohup solana-test-validator \
    --ledger "$LEDGER_DIR" \
    --log > "$LOG_FILE" 2>&1 &
  VALIDATOR_PID=$!
  disown $VALIDATOR_PID 2>/dev/null || true
  echo "$VALIDATOR_PID" > "$PID_FILE"

  echo "Waiting for RPC to initialize ($RPC_URL)..."
  READY=0
  for i in {1..20}; do
    if curl -s -X POST -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","id":1,"method":"getVersion"}' "$RPC_URL" >/dev/null 2>&1; then
      READY=1
      break
    fi
    sleep 1
  done

  if [ $READY -eq 1 ]; then
    solana config set --url "$RPC_URL" >/dev/null 2>&1
    echo "========================================="
    echo "Local Devnet is READY ✅"
    echo "RPC URL   : $RPC_URL"
    echo "WebSocket : ws://127.0.0.1:8900"
    echo "Pubkey    : $(solana address 2>/dev/null)"
    echo "Balance   : $(solana balance 2>/dev/null)"
    echo "PID       : $VALIDATOR_PID"
    echo "========================================="
  else
    echo "ERROR ❌ Validator failed to start within 20s. Check logs: $LOG_FILE"
    exit 1
  fi
}

stop() {
  if [ -f "$PID_FILE" ]; then
    PID=$(cat "$PID_FILE")
    if kill -0 "$PID" 2>/dev/null; then
      echo "Stopping Local Devnet Validator (PID: $PID)..."
      kill "$PID" || true
      sleep 2
      if kill -0 "$PID" 2>/dev/null; then
        kill -9 "$PID" || true
      fi
    fi
    rm -f "$PID_FILE"
    echo "Local Devnet stopped."
  else
    pkill -f "solana-test-validator" 2>/dev/null || true
    echo "Local Devnet stopped (no pidfile)."
  fi
}

status() {
  if curl -s -X POST -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","id":1,"method":"getVersion"}' "$RPC_URL" >/dev/null 2>&1; then
    VERSION=$(curl -s -X POST -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","id":1,"method":"getVersion"}' "$RPC_URL" | grep -o '"solana-core":"[^"]*"' || true)
    echo "Local Devnet is RUNNING ✅ ($VERSION)"
    echo "RPC URL : $RPC_URL"
    echo "Balance : $(solana balance 2>/dev/null || echo 'N/A')"
  else
    echo "Local Devnet is NOT running ❌"
    exit 1
  fi
}

airdrop() {
  AMOUNT=${1:-10}
  echo "Requesting $AMOUNT SOL airdrop on $RPC_URL..."
  solana airdrop "$AMOUNT"
  echo "Updated balance: $(solana balance)"
}

case "$1" in
  start)
    start
    ;;
  stop)
    stop
    ;;
  status)
    status
    ;;
  restart)
    stop
    sleep 1
    start
    ;;
  airdrop)
    airdrop "$2"
    ;;
  logs)
    tail -f "$LOG_FILE"
    ;;
  *)
    echo "Usage: $0 {start|stop|restart|status|airdrop [amount]|logs}"
    exit 1
    ;;
esac
