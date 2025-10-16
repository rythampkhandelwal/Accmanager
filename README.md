For any support, you can contact me on my email :)
rythampkhandelwal@gmail.com


# AccManager - Cloudflare Pages Edition

A secure, self-hosted accounts and secrets manager with Zero-Trust encryption. This version is designed for deployment entirely on Cloudflare's infrastructure (Pages + Workers + D1).

## 🚀 Quick Start Guide

This guide will walk you through deploying AccManager from scratch. Total setup time: ~15 minutes.

---

## Prerequisites

Before you begin, ensure you have:

1. **A Cloudflare account** (free tier works fine)
2. **Node.js** installed (v18 or higher)
3. **Git** installed
4. **Wrangler CLI** installed: `npm install -g wrangler`

---

## Part 1: Database Setup (5 minutes)

### Step 1.1: Login to Wrangler

```bash
wrangler login
```

This will open your browser. Log in to your Cloudflare account.

### Step 1.2: Create D1 Database

```bash
wrangler d1 create accmanager-db
```

**IMPORTANT**: Copy the output! You'll see something like:

```
✅ Successfully created DB 'accmanager-db'!

[[d1_databases]]
binding = "DB"
database_name = "accmanager-db"
database_id = "a1b2c3d4-e5f6-7890-abcd-ef1234567890"  <-- COPY THIS!
```

**Save this `database_id` somewhere safe. You'll need it in Step 2.**

### Step 1.3: Initialize Database Schema

```bash
cd worker
wrangler d1 execute accmanager-db --file=schema.sql
```

You should see: `✅ Executed 6 commands in X.XXs`

---

## Part 2: Worker Configuration (3 minutes)

### Step 2.1: Configure wrangler.toml

1. Navigate to the `worker` folder
2. Copy the example file:
   ```bash
   cp wrangler.toml.example wrangler.toml
   ```

3. Open `wrangler.toml` in your editor

4. **Update line 8** with your database_id from Step 1.2:
   ```toml
   database_id = "a1b2c3d4-e5f6-7890-abcd-ef1234567890"  # Replace with YOUR database_id
   ```

5. **Optional**: Change the worker name on line 1:
   ```toml
   name = "accmanager-worker"  # Change to something unique like "my-vault-worker"
   ```

### Step 2.2: Configure Environment Variables (Optional - for password reset emails)

If you want password reset functionality, set up SMTP secrets:

```bash
wrangler secret put SMTP_HOST
# Enter your SMTP server (e.g., smtp.gmail.com)

wrangler secret put SMTP_PORT
# Enter port (e.g., 587)

wrangler secret put SMTP_USER
# Enter your email

wrangler secret put SMTP_PASS
# Enter your email password or app-specific password

wrangler secret put SMTP_FROM
# Enter the "from" email address
```

**Skip this if you don't need email functionality right now. You can add it later.**

---

## Part 3: Frontend Configuration (2 minutes)

### Step 3.1: Configure Environment Variables

1. Navigate to the `frontend` folder

2. Create a file named `.env.production.local`:
   ```bash
   touch .env.production.local
   ```

3. Open it and add:
   ```
   VITE_API_BASE_URL="https://accmanager-worker.YOUR-USERNAME.workers.dev"
   ```

**Replace:**
- `accmanager-worker` with your worker name from Step 2.1
- `YOUR-USERNAME` with your Cloudflare username (you'll find this in your Cloudflare dashboard)

**Don't know your worker URL yet?** 
- Complete Part 4 first, then come back and update this file
- Then rebuild: `npm run build`

---

## Part 4: Deploy to Cloudflare (5 minutes)

### Step 4.1: Deploy the Worker

```bash
cd worker
npm install
npx wrangler deploy
```

**After deployment, you'll see:**
```
✨ Uploaded accmanager-worker
✨ Published accmanager-worker
  https://accmanager-worker.your-username.workers.dev  <-- COPY THIS URL!
```

**Copy this URL** and update your frontend `.env.production.local` file (see Step 3.1).

### Step 4.2: Build Frontend

```bash
cd ../frontend
npm install
npm run build
```

This creates a `dist` folder with your production-ready frontend.

### Step 4.3: Deploy to Cloudflare Pages

**Option A: Via Dashboard (Recommended for beginners)**

1. Go to [dash.cloudflare.com](https://dash.cloudflare.com)
2. Click **Workers & Pages** → **Create application** → **Pages** → **Upload assets**
3. Name your project (e.g., `accmanager`)
4. Drag and drop the entire `frontend/dist` folder
5. Click **Deploy site**

**Option B: Via Wrangler CLI**

```bash
npx wrangler pages deploy dist --project-name=accmanager
```

---

## Part 5: First-Time Setup

### Step 5.1: Access Your Application

Open the URL from Step 4.3 (e.g., `https://accmanager.pages.dev`)

### Step 5.2: Create Admin Account

You'll see the admin setup screen. Enter:
- **Username**: Your desired admin username
- **Email**: Your email address
- **Password**: A strong master password (REMEMBER THIS! It cannot be recovered)

Click **Create Admin Account**.

### Step 5.3: Login

You'll be redirected to the login page. Use the credentials you just created.

### Step 5.4: Unlock Your Vault

Enter your master password to unlock the vault. Your vault will stay unlocked for 15 minutes.

---

## 🎉 You're Done!

Your AccManager instance is now live and ready to use!

---

## 📖 Usage Guide

### Adding Accounts

1. Click **"Add Entry"** on the Accounts page
2. Fill in the details (Name, Email, Password, etc.)
3. Optionally add 2FA secret for automatic code generation
4. Click **Save**

### Viewing Passwords

- All passwords are visible once your vault is unlocked
- Click the copy button to copy email, password, or 2FA code

### 2FA Codes

- If you add a 2FA secret, AccManager automatically generates TOTP codes
- The code updates every 30 seconds
- Click the copy button to use it

### Admin Panel (Admin users only)

Access via the top navigation. You can:
- View all users
- Reset user passwords
- Delete user accounts
- Export/import data

---

## 🔧 Configuration Reference

### Environment Variables (Frontend)

| Variable | Description | Example |
|----------|-------------|---------|
| `VITE_API_BASE_URL` | Worker API URL | `https://worker.username.workers.dev` |

### Secrets (Worker)

| Secret | Description | Required |
|--------|-------------|----------|
| `SMTP_HOST` | SMTP server hostname | No (only for password reset) |
| `SMTP_PORT` | SMTP server port | No |
| `SMTP_USER` | SMTP username | No |
| `SMTP_PASS` | SMTP password | No |
| `SMTP_FROM` | From email address | No |

### Database

The D1 database is automatically configured via `wrangler.toml`.

---

## 🛠️ Maintenance & Updates

### Update the Worker

```bash
cd worker
npx wrangler deploy
```

### Update the Frontend

```bash
cd frontend
npm run build
npx wrangler pages deploy dist --project-name=accmanager
```

### Backup Your Data

Via Admin Panel:
1. Go to Admin Panel
2. Click **"Export Data"**
3. Save the JSON file securely

Via CLI:
```bash
wrangler d1 export accmanager-db --output=backup.sql
```

### Restore from Backup

Via Admin Panel:
1. Go to Admin Panel
2. Click **"Import Data"**
3. Select your backup JSON file

---

## 🔒 Security Best Practices

1. **Use a strong master password** - It's the key to all your data
2. **Enable 2FA on your Cloudflare account** - Protects your deployment
3. **Regularly export backups** - Store them encrypted in a safe place
4. **Don't share your master password** - Even admins can't recover it
5. **Use HTTPS only** - Cloudflare provides this automatically
6. **Review access logs** - Check your Cloudflare dashboard regularly

---

## ⚙️ Advanced Configuration

### Custom Domain

1. Add your domain to Cloudflare
2. Go to Pages project → **Custom domains**
3. Add your domain
4. Update `VITE_API_BASE_URL` in frontend and rebuild

### Custom Worker Route

1. Go to Workers & Pages → Your worker
2. Click **Triggers** → **Add Custom Domain**
3. Add your custom domain/subdomain

---

## 🐛 Troubleshooting

### "Failed to connect to API"

- Check `VITE_API_BASE_URL` in `.env.production.local`
- Verify worker is deployed: `wrangler deployments list`
- Check worker logs: `wrangler tail`

### "Database not found"

- Verify `database_id` in `wrangler.toml`
- Run schema again: `wrangler d1 execute accmanager-db --file=schema.sql`

### "CPU time limit exceeded"

- This shouldn't happen with the optimized PBKDF2 (100 iterations)
- If it does, check worker logs for specific errors

### "Vault asks for unlock on every refresh"

- This is normal behavior for maximum security
- Vault stays unlocked for 15 minutes within a session
- SessionStorage is used to persist within the same tab

---

## 📚 Additional Resources

- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)
- [Cloudflare Pages Documentation](https://developers.cloudflare.com/pages/)
- [D1 Database Documentation](https://developers.cloudflare.com/d1/)
- [Report Issues](https://github.com/yourusername/accmanager/issues)

---

## 📄 License

[Apache License 2.0]

---

## 🤝 Contributing

Contributions are welcome! Please read our contributing guidelines first.

---

**Built with ❤️ for privacy and security**




























# AccManager - Flexible Deployment Edition (Github-pages)

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

- **Issues**: [GitHub Issues](https://github.com/rythampkhandelwal/accmanager/issues)
- **Discussions**: [GitHub Discussions](https://github.com/rythampkhandelwal/accmanager/discussions)
- **Email**: rythampkhandelwal@gmail.com

---

## 📄 License

[Apache License 2.0]

---

**Enjoy your privacy-first password manager! 🔐**
