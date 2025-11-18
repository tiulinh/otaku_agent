# Hướng dẫn Rebuild và Restart Server

## Khi nào cần làm?

- Sau khi sửa code trong `src/` (backend, plugins, character, etc.)
- Khi muốn xóa toàn bộ user profiles và chat history
- Khi cần reset server về trạng thái ban đầu

## Các bước thực hiện

### Bước 1: Rebuild Backend và Frontend

```bash
# Rebuild backend (bắt buộc sau khi sửa code)
bun run build:backend

# Rebuild frontend (bắt buộc sau khi sửa UI)
bun run build:frontend
```

**Hoặc rebuild tất cả cùng lúc:**

```bash
bun run build
```

### Bước 2: Kill server đang chạy

```bash
# Kill tất cả processes đang dùng port 3000
lsof -ti:3000 | xargs kill -9
```

**Verify không còn process nào:**

```bash
lsof -i:3000
# Không có output = thành công
```

### Bước 3: Clear database (xóa tất cả user đã đăng ký)

```bash
# Xóa toàn bộ database directory
rm -rf /Volumes/DATA/Blockchain/Linh/otaku_agent/.eliza/.elizadb
```

**Lưu ý:** Server sẽ tự tạo lại database mới khi khởi động.

### Bước 4: Start server mới

```bash
# Start server và ghi logs vào file
bun start > /tmp/otaku-server.log 2>&1 &
```

### Bước 5: Verify server đã start thành công

```bash
# Kiểm tra server đang chạy
lsof -i:3000 | grep LISTEN

# Kiểm tra logs startup
tail -50 /tmp/otaku-server.log | grep -E "(✅|validated|Server started|Starting)"
```

**Nên thấy:**
```
✅ Log        OpenAI API key validated successfully
✅ Log        OpenRouter API key validated successfully
✅ Info       [TokenMetrics] Service initialized successfully
```

## One-liner (all steps combined)

```bash
bun run build && lsof -ti:3000 | xargs kill -9 && rm -rf .eliza/.elizadb && bun start > /tmp/otaku-server.log 2>&1 &
```

## Kiểm tra kết quả

1. **Mở browser:** http://localhost:3000
2. **Tạo user mới** (database đã reset nên tất cả users cũ bị xóa)
3. **Test chat:** Gõ "Hello" để verify agent hoạt động

## Rebuild từng phần riêng lẻ

### Chỉ rebuild backend:

```bash
bun run build:backend
lsof -ti:3000 | xargs kill -9
bun start > /tmp/otaku-server.log 2>&1 &
```

### Chỉ rebuild frontend:

```bash
bun run build:frontend
# Không cần restart server, chỉ cần refresh browser
```

### Chỉ rebuild một plugin cụ thể:

```bash
# Ví dụ: rebuild plugin-token-metrics
cd src/plugins/plugin-token-metrics
bun run build
cd ../../../

# Sau đó rebuild backend để bundle plugin mới
bun run build:backend
lsof -ti:3000 | xargs kill -9
bun start > /tmp/otaku-server.log 2>&1 &
```

## Troubleshooting

### Lỗi: "port 3000 already in use"

```bash
# Kiểm tra process nào đang dùng port 3000
lsof -i:3000

# Kill tất cả processes
lsof -ti:3000 | xargs kill -9
```

### Lỗi: "Database migration failed"

```bash
# Xóa database và để server tạo lại
rm -rf .eliza/.elizadb
bun start > /tmp/otaku-server.log 2>&1 &
```

### Server không start

```bash
# Kiểm tra logs chi tiết
tail -100 /tmp/otaku-server.log

# Kiểm tra environment variables
grep -E "OPENAI_API_KEY|OPENROUTER_API_KEY|TOKENMETRICS" .env
```

### Frontend không load

```bash
# Verify frontend đã được build
ls -la dist/frontend/

# Nên thấy:
# index.html
# assets/

# Nếu không có, rebuild:
bun run build:frontend
```

## Logs location

- **Server logs:** `/tmp/otaku-server.log`
- **Token Metrics specific:** `grep "TokenMetrics" /tmp/otaku-server.log`
- **Errors only:** `grep -i error /tmp/otaku-server.log`
- **Real-time monitoring:**
  ```bash
  tail -f /tmp/otaku-server.log
  ```

## Best practices

1. **Luôn rebuild backend** sau khi sửa code trong `src/` directory
2. **Clear database** khi muốn test với fresh state
3. **Check logs** sau khi restart để verify không có errors
4. **Commit code** trước khi rebuild để có thể revert nếu cần
5. **Test với user mới** sau khi clear database

## Workflow thông thường

```bash
# 1. Sửa code
vim src/plugins/plugin-token-metrics/src/actions/getTokenAnalysis.action.ts

# 2. Rebuild
bun run build

# 3. Restart with clean state
lsof -ti:3000 | xargs kill -9
rm -rf .eliza/.elizadb
bun start > /tmp/otaku-server.log 2>&1 &

# 4. Verify
sleep 5
lsof -i:3000 | grep LISTEN
tail -50 /tmp/otaku-server.log | grep -E "(✅|Error)"

# 5. Test
open http://localhost:3000
```
