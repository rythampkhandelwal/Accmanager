# AccManager - Flexible Deployment Edition

A secure, self-hosted accounts and secrets manager with Zero-Trust encryption. This version allows you to host the **frontend** on any static hosting provider (GitHub Pages, Vercel, Netlify, etc.) while running the **backend** on Cloudflare Workers.

## 🎯 Why This Version?

- **Maximum Flexibility**: Host frontend anywhere, backend on Cloudflare Workers
- **Separate Deployment**: Update frontend and backend independently  
- **Cost Effective**: Use free tiers (GitHub Pages + Cloudflare Workers free plan)
- **Easy Scaling**: Serve frontend from CDN of your choice

---

## 🚀 Deployment Guide

Total setup time: ~20 minutes

---

## Prerequisites

1. **A Cloudflare account** (for Workers & D1 database)
2. **A GitHub account** (if using GitHub Pages)
3. **Node.js** installed (v18 or higher)
4. **Git** installed
5. **Wrangler CLI**: `npm install -g wrangler`

---

## PART A: Backend Deployment (Cloudflare Workers)

### Step A1: Login to Cloudflare

```bash
wrangler login
```

### Step A2: Create D1 Database

```bash
wrangler d1 create accmanager-db
```

**IMPORTANT**: Copy the `database_id` from the output:

```
[[d1_databases]]
binding = "DB"
database_name = "accmanager-db"
database_id = "a1b2c3d4-xxxx-xxxx-xxxx-xxxxxxxxxxxx"  <-- COPY THIS!
```

### Step A3: Initialize Database

```bash
cd worker-source
wrangler d1 execute accmanager-db --file=schema.sql
```

### Step A4: Configure Worker

1. **Copy the example config:**
   ```bash
   cp wrangler.toml.example wrangler.toml
   ```

2. **Edit `wrangler.toml`:**

   Open the file and update:

   ```toml
   name = "accmanager-api"  # Change to YOUR unique worker name
   
   [[d1_databases]]
   binding = "DB"
   database_name = "accmanager-db"
   database_id = "YOUR_DATABASE_ID_HERE"  # Paste from Step A2
   ```

3. **Save the file**

### Step A5: Install Dependencies

```bash
npm install
```

### Step A6: Deploy Worker

```bash
npx wrangler deploy
```

**Copy the worker URL from output:**
```
✨ Published accmanager-api
  https://accmanager-api.your-username.workers.dev  <-- SAVE THIS URL!
```

### Step A7: Configure CORS (Important!)

Your worker needs to accept requests from your frontend domain.

**Option 1: During Development**
The worker is pre-configured to accept requests from `localhost` and any origin. This is fine for testing.

**Option 2: Production (Recommended)**

After you deploy your frontend and know its URL, edit `worker-source/src/index.ts`:

Find this line:
```typescript
.use('*', cors({ origin: '*' }))
```

Replace with your frontend URL:
```typescript
.use('*', cors({ 
  origin: 'https://yourusername.github.io',  // Your frontend URL
  credentials: true 
}))
```

Then redeploy: `npx wrangler deploy`

### Step A8: Configure Email (Optional)

For password reset emails, set up SMTP secrets:

```bash
wrangler secret put SMTP_HOST      # e.g., smtp.gmail.com
wrangler secret put SMTP_PORT      # e.g., 587
wrangler secret put SMTP_USER      # Your email
wrangler secret put SMTP_PASS      # App password
wrangler secret put SMTP_FROM      # From address
```

**Skip if not needed now. You can add later.**

---

## PART B: Frontend Deployment

You can deploy to **any static hosting**. We'll cover GitHub Pages, but the process is similar for Vercel, Netlify, etc.

### Step B1: Configure API URL

1. Navigate to `frontend-source` folder

2. Create `.env.production.local` file:
   ```bash
   touch .env.production.local
   ```

3. Add your worker URL from Step A6:
   ```
   VITE_API_BASE_URL="https://accmanager-api.your-username.workers.dev"
   ```

   **Important:** No trailing slash!

### Step B2: Install Dependencies

```bash
npm install
```

### Step B3: Build Frontend

```bash
npm run build
```

This creates a `dist` folder with your production build.

---

## PART C: Deploy Frontend to GitHub Pages

### Method 1: Manual Upload (Easiest)

1. **Create a new GitHub repository**
   - Go to github.com
   - Click "New repository"
   - Name it `accmanager` (or anything you like)
   - Make it **Public**
   - Click "Create repository"

2. **Initialize and push the dist folder:**

   ```bash
   cd dist
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/YOUR-USERNAME/accmanager.git
   git push -u origin main
   ```

3. **Enable GitHub Pages:**
   - Go to your repository on GitHub
   - Click **Settings** → **Pages**
   - Under "Source", select `main` branch
   - Click **Save**

4. **Access your site:**
   - After a minute, your site will be live at:
     `https://YOUR-USERNAME.github.io/accmanager`

### Method 2: Automated Deployment (Advanced)

Create `.github/workflows/deploy.yml` in your repository:

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
      - run: npm ci
        working-directory: ./frontend-source
      - run: npm run build
        working-directory: ./frontend-source
      - uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./frontend-source/dist
```

Now every push to `main` automatically deploys!

---

## Alternative: Deploy to Vercel

1. Install Vercel CLI: `npm install -g vercel`
2. Run: `vercel deploy dist --prod`
3. Follow the prompts

## Alternative: Deploy to Netlify

1. Install Netlify CLI: `npm install -g netlify-cli`
2. Run: `netlify deploy --prod --dir=dist`
3. Follow the prompts

---

## PART D: First-Time Setup

### Step D1: Open Your Application

Navigate to your frontend URL (e.g., `https://username.github.io/accmanager`)

### Step D2: Create Admin Account

- Enter username, email, and a strong master password
- **CRITICAL**: Save your master password securely. It CANNOT be recovered!
- Click **Create Admin Account**

### Step D3: Login & Start Using

Login with your credentials and start adding accounts!

---

## 🔧 Configuration Reference

### Environment Variables

#### Frontend (`.env.production.local`)

```bash
VITE_API_BASE_URL="https://your-worker.workers.dev"
```

#### Worker Secrets

```bash
# Optional - for password reset emails
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_USER="your-email@gmail.com"
SMTP_PASS="your-app-password"
SMTP_FROM="noreply@yourdomain.com"
```

### wrangler.toml Structure

```toml
name = "your-worker-name"          # Must be unique
main = "src/index.ts"
compatibility_date = "2025-10-15"

[[d1_databases]]
binding = "DB"
database_name = "accmanager-db"
database_id = "your-database-id"   # From Step A2
```

---

## 🔄 Updates & Maintenance

### Update Backend (Worker)

```bash
cd worker-source
npx wrangler deploy
```

### Update Frontend

```bash
cd frontend-source
npm run build
# Then deploy dist folder to your hosting provider
```

### Backup Database

```bash
wrangler d1 export accmanager-db --output=backup.sql
```

### Restore Database

```bash
wrangler d1 import accmanager-db --file=backup.sql
```

---

## 🐛 Troubleshooting

### "Failed to connect to API"

**Cause**: Frontend can't reach worker

**Solutions**:
1. Check `VITE_API_BASE_URL` in `.env.production.local`
2. Verify worker is deployed: `wrangler deployments list`
3. Check CORS settings in worker
4. Open browser DevTools → Network tab to see exact error

### "CORS Error"

**Cause**: Worker not allowing frontend origin

**Solution**: Update CORS in `worker-source/src/index.ts` (see Step A7)

### "Database not found"

**Cause**: Wrong `database_id` in `wrangler.toml`

**Solution**: 
1. List databases: `wrangler d1 list`
2. Copy correct ID to `wrangler.toml`
3. Redeploy: `npx wrangler deploy`

### "CPU time limit exceeded"

**Cause**: Rare, but possible under heavy load

**Solution**: Already optimized with PBKDF2 (100 iterations). Check worker logs: `wrangler tail`

### GitHub Pages shows 404

**Cause**: Pages not enabled or wrong branch

**Solution**:
1. Go to repo **Settings** → **Pages**
2. Ensure `main` branch is selected
3. Wait 2-3 minutes for deployment

---

## 🔒 Security Best Practices

### Essential

1. ✅ **Strong master password** - Your encryption key
2. ✅ **Enable 2FA on Cloudflare** - Protects backend
3. ✅ **Enable 2FA on GitHub** - Protects frontend
4. ✅ **Regular backups** - Export data monthly
5. ✅ **HTTPS only** - Both platforms provide this

### Recommended

1. 🔐 **Custom domain** - Looks professional, easier to remember
2. 🔐 **Restrict CORS** - Limit worker to your frontend domain only
3. 🔐 **Monitor access logs** - Check Cloudflare analytics
4. 🔐 **Review permissions** - Limit who has repo access

### Advanced

1. 🛡️ **Content Security Policy** - Add CSP headers
2. 🛡️ **Rate limiting** - Implement in worker
3. 🛡️ **Geo-restrictions** - Block unwanted regions in Cloudflare

---

## 📚 Project Structure

```
accmanager-github-pages/
├── frontend-source/          # React frontend
│   ├── src/                  # Source code
│   ├── dist/                 # Build output
│   ├── package.json
│   └── .env.production.local # Your config
│
├── worker-source/            # Cloudflare Worker backend
│   ├── src/                  # Worker source
│   ├── schema.sql            # Database schema
│   ├── wrangler.toml         # Your config
│   └── package.json
│
└── README.md                 # This file
```

---

## 🎨 Customization

### Change App Name/Branding

Edit `frontend-source/index.html`:

```html
<title>Your Vault Name</title>
```

Edit `frontend-source/src/components/*.tsx` files to change text/branding.

### Change Theme Colors

Edit `frontend-source/tailwind.config.js`:

```js
theme: {
  extend: {
    colors: {
      primary: {
        600: '#your-color',  // Change this
      }
    }
  }
}
```

Then rebuild: `npm run build`

---

## 📊 Cost Breakdown

### Free Tier (Sufficient for personal use)

- **GitHub Pages**: Free (1GB storage, 100GB bandwidth/month)
- **Cloudflare Workers**: Free (100,000 requests/day)
- **Cloudflare D1**: Free (5GB storage, 5M rows read/day)

**Total: $0/month** 🎉

### If you exceed free tier

- **GitHub Pages Pro**: $4/month (unlimited)
- **Cloudflare Workers Paid**: $5/month (10M requests)
- **Cloudflare D1 Paid**: $5/month (25B rows read)

---

## 🌐 Custom Domain Setup

### For Frontend (GitHub Pages)

1. Add `CNAME` file to `dist` folder:
   ```
   vault.yourdomain.com
   ```

2. Add DNS record at your domain provider:
   ```
   CNAME vault.yourdomain.com username.github.io
   ```

3. Enable HTTPS in GitHub Pages settings

### For Worker (Cloudflare)

1. Add custom route in Cloudflare Workers dashboard
2. Update frontend `VITE_API_BASE_URL`
3. Rebuild and redeploy frontend

---

## 💡 Tips & Tricks

1. **Bookmark your vault** - Add to favorites for quick access
2. **Use browser password manager** - For the master password only
3. **Mobile access** - Fully responsive, works great on phones
4. **Export before major updates** - Backup data first
5. **Test in incognito** - Verify CORS and API connectivity

---

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/yourusername/accmanager/issues)
- **Discussions**: [GitHub Discussions](https://github.com/yourusername/accmanager/discussions)
- **Email**: your-email@example.com

---

## 📄 License

[Add your license]

---

**Enjoy your privacy-first password manager! 🔐**
