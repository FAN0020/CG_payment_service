# 🚀 ClassGuru Ad Service Deployment Guide

This guide explains how to deploy your local ad service to the public internet using frp (Fast Reverse Proxy).

## 📋 Prerequisites

- Ad service running locally on `http://localhost:8791`
- frp client (`frpc`) installed on your machine
- Access to frp server: `154.36.178.157:7000`

## 🔧 Configuration

The repository includes `frpc.toml` with pre-configured settings:

```toml
serverAddr = "154.36.178.157"
serverPort = 7000

[auth]
method = "token"
token  = "classguruaipwd12262wenyz"

[[proxies]]
name       = "ym"
type       = "tcp"
localIP    = "127.0.0.1"
localPort  = 8791
remotePort = 12280
```

## 🎯 Deployment Steps

### Step 1: Start Your Local Ad Service

```powershell
# Navigate to project directory
cd path/to/CG_ad_service

# Start the ad service
npm run dev
```

Your service should be running on `http://localhost:8791`

### Step 2: Start frp Client

Open a **new terminal** and run:

```powershell
# Navigate to frp directory and run frpc
cd frp
.\frpc.exe -c frpc.toml
```

You should see output like:
```
[I] [service.go:xxx] login to server success
[I] [proxy_manager.go:xxx] proxy added: [ym-ad-service]
```

### Step 3: Access via Public Domain

Your ad service is now accessible at:

- **Public URL**: `http://ym.test.classguruai.com:12280`
- **Demo Page**: `http://ym.test.classguruai.com:12280/demo/demo.html`
- **Health Check**: `http://ym.test.classguruai.com:12280/api/ads/health`

## 🎨 Google AdSense Integration

Once deployed to the public domain:

1. **Add Domain to AdSense**
   - Go to [Google AdSense](https://www.google.com/adsense/)
   - Add `ym.test.classguruai.com` to your site list
   - Wait for verification (may take a few hours)

2. **Update AdSense Settings**
   - Your ad unit (slot: `6990272185`) should now display real ads
   - Google will verify the domain and start serving ads

3. **Test Real Ads**
   - Visit: `http://ym.test.classguruai.com:12280/demo/demo.html`
   - Refresh the page and wait a few seconds
   - Real Google ads should appear instead of demo placeholders

## 🔍 Troubleshooting

### frpc Connection Issues

If frpc cannot connect:
```powershell
# Check if frpc is installed
cd frp
.\frpc.exe --version

# Test connection to frp server
ping 154.36.178.157
```

### Ads Not Showing

1. **Domain Not Approved**: Check AdSense dashboard for domain approval status
2. **Ad Blocker**: Disable browser ad blockers
3. **New Ad Unit**: Wait 24-48 hours for Google to review and activate
4. **CORS Issues**: Ensure `.env` includes the public domain in `CORS_ORIGIN`

### Port Already in Use

If port 12280 is already in use on the server, contact your server administrator.

## 📝 Important Notes

- Keep both terminals running (ad service + frpc)
- If you restart your local service, frpc will automatically reconnect
- The public URL is only accessible when both services are running
- For production deployment, consider using PM2 or systemd to keep services running

## 🔐 Security Considerations

- The frp token is sensitive - do not commit to public repositories
- Consider using HTTPS for production (requires SSL certificate)
- Implement rate limiting and authentication for production use

## 📊 Monitoring

Check service status:

```powershell
# Test health endpoint
curl http://ym.test.classguruai.com:12280/api/ads/health

# View frpc logs
# Check terminal where frpc is running

# View ad service logs
# Check terminal where npm run dev is running
```

## 🆘 Support

If you encounter issues:
1. Check both terminal windows for error messages
2. Verify local service is running: `http://localhost:8791/api/ads/health`
3. Verify frpc connection in frpc terminal
4. Check AdSense dashboard for domain approval status
