# 🚀 Deployment Guide - MEV Protection Scanner

This guide covers deploying your MEV Protection Scanner to production with x402 monetization.

## 📋 Pre-Deployment Checklist

- [ ] Infura or Blocknative API key obtained
- [ ] Base network wallet created for payment receiving
- [ ] Domain registered and DNS configured
- [ ] Environment variables prepared
- [ ] Testing completed locally

## 🎯 Deployment Options

### Option 1: Cloudflare Workers (Recommended)

**Why Cloudflare?**
- ✅ Global edge network (low latency)
- ✅ Native Hono support
- ✅ Generous free tier
- ✅ Automatic SSL
- ✅ Built-in DDoS protection

**Steps:**

```bash
# Install Wrangler CLI
npm install -g wrangler

# Login to Cloudflare
wrangler login

# Create wrangler.toml
cat > wrangler.toml << EOF
name = "mev-protection-scanner"
main = "mev-protection-scanner.ts"
compatibility_date = "2024-01-01"

[vars]
NETWORK = "base"
DEFAULT_PRICE = "1000"

[env.production]
name = "mev-protection-scanner"
route = "mev-scanner.yourdomain.com/*"
EOF

# Deploy
wrangler deploy
```

**Add secrets:**
```bash
wrangler secret put ADDRESS
wrangler secret put INFURA_PROJECT_ID
wrangler secret put INFURA_WS_URL
```

**Custom Domain:**
```bash
# In Cloudflare Dashboard:
# Workers & Pages > mev-protection-scanner > Settings > Triggers
# Add Custom Domain: mev-scanner.yourdomain.com
```

---

### Option 2: Railway

**Why Railway?**
- ✅ Simple Git-based deployments
- ✅ Built-in databases (if needed later)
- ✅ Generous free tier
- ✅ Automatic HTTPS

**Steps:**

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Initialize project
railway init

# Link to GitHub repo (optional)
railway link

# Add environment variables via Railway Dashboard
# Settings > Variables > Add all from .env

# Deploy
railway up
```

**Custom Domain:**
```bash
# In Railway Dashboard:
# Settings > Domains > Add Custom Domain
# Add DNS records as instructed
```

---

### Option 3: Fly.io

**Why Fly.io?**
- ✅ Global edge deployment
- ✅ Great for WebSocket connections
- ✅ Free tier available

**Steps:**

```bash
# Install flyctl
curl -L https://fly.io/install.sh | sh

# Login
flyctl auth login

# Launch app
flyctl launch --name mev-protection-scanner

# Edit fly.toml to set environment
# Add secrets
flyctl secrets set ADDRESS=0xYourAddress
flyctl secrets set INFURA_PROJECT_ID=your_id
flyctl secrets set INFURA_WS_URL=wss://...

# Deploy
flyctl deploy
```

---

### Option 4: VPS (DigitalOcean, Linode, etc.)

**Why VPS?**
- ✅ Full control
- ✅ Can run custom infrastructure
- ✅ Good for high-volume agents

**Steps:**

```bash
# SSH into your VPS
ssh root@your-server-ip

# Install Bun
curl -fsSL https://bun.sh/install | bash

# Clone your repo
git clone https://github.com/yourusername/mev-protection-scanner.git
cd mev-protection-scanner

# Install dependencies
bun install

# Create .env file
nano .env
# Add all your environment variables

# Install PM2 for process management
bun add -g pm2

# Start the agent
pm2 start mev-protection-scanner.ts --name mev-scanner --interpreter bun

# Setup auto-restart on reboot
pm2 startup
pm2 save

# Setup Nginx as reverse proxy
sudo apt install nginx
sudo nano /etc/nginx/sites-available/mev-scanner

# Add this configuration:
server {
    listen 80;
    server_name mev-scanner.yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}

# Enable the site
sudo ln -s /etc/nginx/sites-available/mev-scanner /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx

# Setup SSL with Let's Encrypt
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d mev-scanner.yourdomain.com
```

---

## 🔧 Environment Variables Setup

### Required Variables

```bash
# Payment Configuration
ADDRESS=0xYourBaseWalletAddress           # REQUIRED
DEFAULT_PRICE=1000                        # REQUIRED
NETWORK=base                              # REQUIRED
FACILITATOR_URL=https://facilitator.x402.org  # REQUIRED

# Mempool Data (choose ONE)
INFURA_PROJECT_ID=your_project_id         # Option 1
INFURA_WS_URL=wss://mainnet.infura.io/ws/v3/your_id

# OR
BLOCKNATIVE_API_KEY=your_api_key          # Option 2
```

### Optional Variables

```bash
# Server
PORT=3000
HOST=0.0.0.0

# Performance
MAX_MEMPOOL_SIZE=100
CACHE_TTL_SECONDS=30
RATE_LIMIT_PER_MINUTE=60

# Logging
LOG_LEVEL=info
LOG_FORMAT=json

# CORS
CORS_ORIGINS=*

# Agent Identity (for trust metadata)
AGENT_DOMAIN=mev-scanner.yourdomain.com
CHAIN_ID=8453
IDENTITY_REGISTRY_ADDRESS=0x...
RPC_URL=https://mainnet.base.org
```

---

## 🌐 DNS Configuration

### Point Your Domain

Add these DNS records to your domain:

**For Cloudflare Workers:**
```
Type: CNAME
Name: mev-scanner
Value: your-worker.workers.dev
Proxy: Yes (Orange Cloud)
```

**For Railway/Fly.io:**
```
Type: CNAME
Name: mev-scanner
Value: provided-by-platform.railway.app
```

**For VPS:**
```
Type: A
Name: mev-scanner
Value: your-server-ip
```

### Verify DNS Propagation

```bash
# Check DNS
dig mev-scanner.yourdomain.com

# Test HTTPS
curl https://mev-scanner.yourdomain.com/health
```

---

## 🔍 Post-Deployment Verification

### 1. Health Check

```bash
curl https://mev-scanner.yourdomain.com/health
```

Expected response:
```json
{
  "ok": true,
  "version": "1.0.0"
}
```

### 2. Agent Manifest

```bash
curl https://mev-scanner.yourdomain.com/.well-known/agent.json
```

Should return full AgentCard with:
- ✅ Skills array
- ✅ Payment configuration
- ✅ x402 accepts array

### 3. Test x402 Payment Flow

```bash
# Request without payment (should return 402)
curl -X POST https://mev-scanner.yourdomain.com/entrypoints/scan_transaction/invoke \
  -H "Content-Type: application/json" \
  -d '{
    "input": {
      "token_in": "USDC",
      "token_out": "ETH",
      "amount_in": "1000",
      "dex": "uniswap-v2"
    }
  }'
```

Expected: HTTP 402 with payment requirements

### 4. Performance Test

```bash
# Measure response time
time curl -X POST https://mev-scanner.yourdomain.com/entrypoints/scan_transaction/invoke \
  -H "Content-Type: application/json" \
  -H "X-Payment-Transaction: valid_payment_proof" \
  -d '{"input":{"token_in":"USDC","token_out":"ETH","amount_in":"1000","dex":"uniswap-v2"}}'
```

Should complete in < 3 seconds

---

## 📊 Monitoring & Analytics

### Application Monitoring

**Cloudflare:**
- Dashboard > Workers > mev-protection-scanner > Analytics
- Track: Requests, Errors, CPU time

**Railway:**
- Dashboard > mev-protection-scanner > Metrics
- Track: CPU, Memory, Network

**Custom (VPS):**
```bash
# Install monitoring
pm2 install pm2-logrotate
pm2 logs mev-scanner --lines 100
```

### Payment Monitoring

Track payments on Base:
```
https://basescan.org/address/YOUR_ADDRESS
```

### Uptime Monitoring

Use services like:
- UptimeRobot (free)
- Pingdom
- StatusCake

Example check:
```
URL: https://mev-scanner.yourdomain.com/health
Interval: 5 minutes
Alert: If down for 2 checks
```

---

## 🛡️ Security Hardening

### 1. Rate Limiting

Already built-in via `RATE_LIMIT_PER_MINUTE=60`

For additional protection:

**Cloudflare:**
- Enable "Under Attack" mode if needed
- Set custom rate limit rules

**Nginx:**
```nginx
limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;

location /entrypoints {
    limit_req zone=api burst=20;
}
```

### 2. CORS Configuration

Production setting:
```bash
CORS_ORIGINS=https://yourapp.com,https://wallet.yourapp.com
```

### 3. Secret Management

**Never commit:**
- `.env` files
- API keys
- Private keys

**Use:**
- Platform secret managers
- Environment variables
- HashiCorp Vault (enterprise)

### 4. API Key Rotation

Rotate keys quarterly:
```bash
# Generate new Infura key
# Update environment variables
# Monitor old key usage
# Deprecate old key after 1 week
```

---

## 📈 Scaling Considerations

### Horizontal Scaling

**Cloudflare Workers:**
- Automatic global scaling
- No action needed

**Railway/Fly.io:**
```bash
# Scale to multiple instances
railway scale --replicas 3
flyctl scale count 3
```

**VPS:**
- Use load balancer (nginx, HAProxy)
- Deploy to multiple servers
- Share state via Redis

### Vertical Scaling

If response times increase:
1. Increase `MAX_MEMPOOL_SIZE`
2. Reduce `CACHE_TTL_SECONDS`
3. Upgrade instance size
4. Add caching layer (Redis)

### Caching Strategy

```typescript
// Add to mev-protection-scanner.ts
import { LRUCache } from "lru-cache";

const cache = new LRUCache({
  max: 500,
  ttl: 1000 * 30, // 30 seconds
});

// Cache mempool data
const cacheKey = `mempool:${dex}:${Date.now() / 30000 | 0}`;
```

---

## 🎯 x402scan.com Listing

Once deployed, your agent will auto-list on x402scan if:

✅ Accessible at `https://yourdomain.com/.well-known/agent.json`  
✅ Returns valid AgentCard with x402 metadata  
✅ Responds correctly to payment flow  
✅ Has proper `outputSchema` in accepts array  

**No manual submission needed!**

Verify listing at: https://x402scan.com

---

## 🔄 Continuous Deployment

### GitHub Actions (Example)

```yaml
# .github/workflows/deploy.yml
name: Deploy to Production

on:
  push:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Bun
        uses: oven-sh/setup-bun@v1
      
      - name: Install dependencies
        run: bun install
      
      - name: Run tests
        run: bun test
      
      - name: Deploy to Cloudflare
        run: |
          npm install -g wrangler
          wrangler deploy
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
```

---

## 🆘 Troubleshooting

### Issue: 402 Payment Required

**Symptom:** All requests return 402
**Fix:** Verify `ADDRESS` and `FACILITATOR_URL` are set

### Issue: Slow Response Times

**Symptom:** Scans take >3 seconds
**Fix:** 
- Check Infura/Blocknative API latency
- Reduce `MAX_MEMPOOL_SIZE`
- Add caching layer

### Issue: Invalid Manifest

**Symptom:** Agent not discoverable
**Fix:**
- Verify `/.well-known/agent.json` returns valid JSON
- Check x402 schema compliance
- Test with: `curl https://yourdomain.com/.well-known/agent.json | jq`

### Issue: High Error Rate

**Symptom:** Many failed scans
**Fix:**
- Check API key validity
- Monitor API rate limits
- Review error logs
- Add retry logic

---

## 📞 Support Resources

- **x402 Protocol**: https://x402.org
- **agent-kit Docs**: https://github.com/lucid-dreams/agent-kit
- **Infura Support**: https://support.infura.io
- **Blocknative Docs**: https://docs.blocknative.com

---

**You're ready to deploy! 🚀**

Remember:
1. Test thoroughly in staging first
2. Monitor performance closely
3. Keep API keys secure
4. Scale based on actual usage
5. Join the community for support

Happy deploying! 🎉
