# Payment System Setup Guide

## 🎯 Overview
The payment system uses **Stripe** for card payments and supports multiple payment methods including cash, card, and wallet.

---

## 📋 Prerequisites

### 1. Create a Stripe Account
1. Go to https://stripe.com
2. Sign up for a free account
3. Get your API keys from the Dashboard

### 2. Install Dependencies
```bash
npm install stripe
```

---

## ⚙️ Configuration

### 1. Environment Variables (.env)
Add these to your `.env` file:

```env
# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_51...your_key
STRIPE_PUBLISHABLE_KEY=pk_test_51...your_key
STRIPE_WEBHOOK_SECRET=whsec_...your_webhook_secret

# Payment Settings
PAYMENT_CURRENCY=usd
```

**Where to get these:**
- **Secret Key**: Stripe Dashboard → Developers → API Keys
- **Publishable Key**: Same location as Secret Key
- **Webhook Secret**: Stripe Dashboard → Developers → Webhooks (after creating webhook)

---

## 🔧 How to Use

### **Method 1: Card Payment (via Stripe)**

**Frontend Implementation:**
```javascript
// 1. Create payment on backend
const response = await fetch('/api/v1/payments', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer YOUR_JWT_TOKEN'
  },
  body: JSON.stringify({
    ticketId: 'ticket_id_here',
    amount: 50.00,
    paymentMethod: 'card',
    paymentMethodId: 'pm_1234567890' // From Stripe.js
  })
});

const { data } = await response.json();
console.log('Payment created:', data.payment);
```

**Using Stripe.js in Frontend:**
```html
<!-- Include Stripe.js -->
<script src="https://js.stripe.com/v3/"></script>

<script>
// Initialize Stripe
const stripe = Stripe('YOUR_PUBLISHABLE_KEY');

// Create payment method
const { paymentMethod, error } = await stripe.createPaymentMethod({
  type: 'card',
  card: cardElement, // Stripe Card Element
  billing_details: {
    name: 'Customer Name',
    email: 'customer@email.com'
  }
});

if (error) {
  console.error('Error:', error);
} else {
  // Use paymentMethod.id as paymentMethodId in your backend call
  const paymentMethodId = paymentMethod.id;
}
</script>
```

---

### **Method 2: Cash Payment**

```javascript
const response = await fetch('/api/v1/payments', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer YOUR_JWT_TOKEN'
  },
  body: JSON.stringify({
    ticketId: 'ticket_id_here',
    amount: 50.00,
    paymentMethod: 'cash'
  })
});
```

---

### **Method 3: Wallet Payment**

```javascript
const response = await fetch('/api/v1/payments', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer YOUR_JWT_TOKEN'
  },
  body: JSON.stringify({
    ticketId: 'ticket_id_here',
    amount: 50.00,
    paymentMethod: 'wallet'
  })
});
```

---

## 🔔 Webhook Setup

### 1. Set Up Stripe Webhook

1. Go to Stripe Dashboard → Developers → Webhooks
2. Click "Add endpoint"
3. URL: `https://your-domain.com/api/v1/payments/webhook/stripe`
4. Select events to listen for:
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `charge.refunded`
5. Copy the webhook signing secret

### 2. Add Secret to .env
```env
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret
```

### 3. Test Webhook (Development)
Use Stripe CLI:
```bash
# Install Stripe CLI
# https://stripe.com/docs/stripe-cli

# Login
stripe login

# Forward webhooks to local server
stripe listen --forward-to localhost:5000/api/v1/payments/webhook/stripe
```

---

## 🔍 API Endpoints

### Create Payment
```http
POST /api/v1/payments
Authorization: Bearer {token}
Content-Type: application/json

{
  "ticketId": "ticket_id",
  "amount": 50.00,
  "paymentMethod": "card",
  "paymentMethodId": "pm_1234567890"  // Required for card payments
}
```

### Get Payment
```http
GET /api/v1/payments/:id
Authorization: Bearer {token}
```

### Get User's Payments
```http
GET /api/v1/payments/users/me/payments?page=1&limit=10
Authorization: Bearer {token}
```

### Refund Payment
```http
POST /api/v1/payments/:id/refund
Authorization: Bearer {token}
Content-Type: application/json

{
  "reason": "Customer requested refund",
  "amount": 50.00  // Optional, defaults to full amount
}
```

### Get Receipt
```http
GET /api/v1/payments/:id/receipt
Authorization: Bearer {token}
```

### Verify Payment
```http
POST /api/v1/payments/verify
Authorization: Bearer {token}
Content-Type: application/json

{
  "paymentId": "payment_id",
  "transactionId": "TXN-123456"
}
```

---

## 🧪 Testing

### Test Card Numbers (Stripe Test Mode)
```
Successful payment:
4242 4242 4242 4242

Requires authentication:
4000 0025 0000 3155

Declined card:
4000 0000 0000 9995

Insufficient funds:
4000 0000 0000 9995
```

**Test Details:**
- Expiry: Any future date (e.g., 12/34)
- CVC: Any 3 digits (e.g., 123)
- ZIP: Any 5 digits (e.g., 12345)

---

## 💡 Payment Flow

```
1. User creates ticket
   ↓
2. User initiates payment
   ↓
3. Backend creates Payment record (status: pending)
   ↓
4. If card payment:
   - Backend creates Stripe Payment Intent
   - Frontend confirms payment with Stripe
   - Stripe sends webhook
   - Backend updates payment status
   ↓
5. Ticket paymentStatus updated to 'paid'
   ↓
6. User receives confirmation
```

---

## 🛡️ Security Notes

1. **Never expose Secret Keys** in frontend code
2. **Always use HTTPS** in production
3. **Verify webhook signatures** (already implemented)
4. **Store sensitive data securely** (PCI compliance)
5. **Use test keys** for development

---

## 🐛 Troubleshooting

### Payment Not Processing
- Check Stripe API keys are correct
- Verify `STRIPE_SECRET_KEY` is set in .env
- Check network connection to Stripe API

### Webhook Not Receiving Events
- Verify webhook URL is accessible
- Check `STRIPE_WEBHOOK_SECRET` matches Stripe Dashboard
- Use Stripe CLI for local testing

### Refund Failing
- Ensure payment is in 'completed' status
- Check refund amount doesn't exceed payment amount
- Verify Stripe account has refunds enabled

---

## 📊 Payment Status Flow

```
pending → completed → refunded
   ↓
 failed
```

---

## 🎨 Frontend Integration Example

```javascript
// Complete payment flow example
async function processPayment(ticketId, amount) {
  try {
    // 1. Create payment intent on backend
    const response = await fetch('/api/v1/payments', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        ticketId,
        amount,
        paymentMethod: 'card',
        paymentMethodId: paymentMethodId
      })
    });

    const result = await response.json();

    if (result.success) {
      alert('Payment successful!');
      // Redirect to ticket page or confirmation
    } else {
      alert('Payment failed: ' + result.message);
    }
  } catch (error) {
    console.error('Payment error:', error);
    alert('Payment processing error');
  }
}
```

---

## 📞 Support

For issues with:
- **Stripe**: https://support.stripe.com
- **Application**: Contact your development team

---

## ✅ Checklist

- [ ] Stripe account created
- [ ] API keys added to .env
- [ ] Stripe npm package installed
- [ ] Webhook endpoint configured
- [ ] Test payment in development
- [ ] Frontend integration complete
- [ ] Production keys updated (when deploying)
