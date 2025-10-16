-- Update admin password to use optimized PBKDF2 (100 iterations for minimal CPU usage)
-- Run this SQL to update your admin password

UPDATE users 
SET password_hash = '$pbkdf2$100$AsPCkVUNSlmdKQoPdLpwAQ==$yi1kq/ET/FQz+62fpkwI5c2PZDIr14U0gujUFyFHPjs=' 
WHERE username = 'admin';

-- Verify the update
SELECT username, email, substr(password_hash, 1, 50) as password_hash_preview FROM users WHERE username = 'admin';
