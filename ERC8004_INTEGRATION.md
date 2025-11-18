# ERC-8004 Agent Card Integration Guide

## 📋 Tổng quan

File này hướng dẫn tích hợp ERC-8004 agent-card.json vào otaku_agent server.

## ✅ Đã hoàn thành

### 1. Thêm route ERC-8004 Agent Card
**File:** `src/packages/server/src/index.ts`
**Vị trí:** Line 734-809

Route `/.well-known/agent-card.json` đã được thêm vào, trả về JSON object với thông tin agent.

### 2. Thêm exception trong middleware
**File:** `src/packages/server/src/index.ts`
**Vị trí:**
- Line 1055-1058: Exception trong API 404 middleware
- Line 1129-1134: Exception trong SPA fallback middleware

Đảm bảo route `.well-known` không bị SPA fallback override.

## 🔧 Cách test

### Bước 1: Build backend
```bash
cd /Volumes/DATA/Blockchain/Linh/otaku_agent
bun run build:backend
```

### Bước 2: Start server
```bash
bun run start
```

### Bước 3: Test endpoint
```bash
# Test với curl
curl http://localhost:3000/.well-known/agent-card.json

# Test với jq (format JSON)
curl -s http://localhost:3000/.well-known/agent-card.json | jq '.'

# Kiểm tra headers
curl -I http://localhost:3000/.well-known/agent-card.json
```

### Kết quả mong đợi:
```json
{
  "name": "DauGia NFT AI Agent",
  "description": "AI Agent for NFT auction and trend analysis",
  "version": "1.0.0",
  "registrations": [
    {
      "agentId": 1,
      "agentDomain": "daugianft.site",
      "agentAddress": "eip155:84532:0x71D8679Ca0eCfCaB431327A95aAdBa2b664cd744",
      "registryContract": "eip155:84532:0x1E5f60eDD5B133fDb2b0740589FA4f1Ffb4f1A63",
      "signature": "0xf16fb6119ff8b10ae28bb38fe3dbe05594535f59e90e20b127c2201c24dd9792504f5767d1bc3cc315f921b782370dfc93f3cd3880880f9821a36c577a29dab51b"
    }
  ],
  "capabilities": [...],
  "accessRequirements": {...},
  "pricing": {...},
  "endpoints": {...},
  "contact": {...},
  "metadata": {...}
}
```

## 🔍 Troubleshooting

### Vấn đề 1: Nhận được HTML thay vì JSON
**Nguyên nhân:** SPA fallback đang catch route
**Giải pháp:** Kiểm tra lại code ở line 1129-1134, đảm bảo exception cho `.well-known` đã có

### Vấn đề 2: 404 Not Found
**Nguyên nhân:** Route chưa được đăng ký
**Giải pháp:**
1. Kiểm tra route ở line 737-809 có tồn tại không
2. Kiểm tra build đã chạy chưa: `bun run build:backend`
3. Restart server

### Vấn đề 3: "Client application not found"
**Nguyên nhân:** Frontend chưa được build
**Giải pháp:**
```bash
# Build frontend
bun run build:frontend

# Hoặc build tất cả
bun run build
```

## 📝 Cập nhật thông tin Agent

Để cập nhật thông tin trong agent-card, sửa object `agentCard` trong file:

**File:** `src/packages/server/src/index.ts`
**Line:** 738-803

Sau đó rebuild và restart server.

### Các trường quan trọng cần cập nhật:

1. **agentDomain**: Domain chính thức của bạn (hiện tại: `daugianft.site`)
2. **agentAddress**: Địa chỉ Ethereum của agent owner
3. **registryContract**: Địa chỉ ERC-8004 registry contract
4. **signature**: Chữ ký ownership (tạo từ `setup.js signature`)
5. **endpoints**: API, WebSocket, Docs URLs
6. **contact**: Website và email

## 🚀 Deploy lên Production

### Railway Deploy

1. Đảm bảo code đã commit:
```bash
git add .
git commit -m "Add ERC-8004 agent-card integration"
git push origin main
```

2. Railway sẽ tự động deploy

3. Test trên production:
```bash
curl https://your-domain/.well-known/agent-card.json
```

### Environment Variables (nếu cần)

Nếu muốn dynamic config, thêm vào `.env`:
```
AGENT_DOMAIN=daugianft.site
AGENT_ID=1
AGENT_ADDRESS=0x71D8679Ca0eCfCaB431327A95aAdBa2b664cd744
REGISTRY_CONTRACT=0x1E5f60eDD5B133fDb2b0740589FA4f1Ffb4f1A63
```

Sau đó sửa code để đọc từ `process.env`.

## 📚 Tham khảo

- ERC-8004 Spec: [Link to spec]
- Registry Contract: `0x1E5f60eDD5B133fDb2b0740589FA4f1Ffb4f1A63` (Base Sepolia)
- Setup Script: `/Volumes/DATA/Blockchain/Linh/erc8004/createAgentTest/setup.js`

## ✨ Next Steps

1. ✅ Test local endpoint
2. ✅ Verify JSON format
3. ✅ Deploy to production
4. ⬜ Test production endpoint
5. ⬜ Verify signature với onchain data
6. ⬜ Integrate với client applications
