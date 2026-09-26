const Stripe = require('stripe');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const PRODUCTS = {
  'Jogging Floral': 2500,
  'Hoodie Floral': 4000,
  'Ensemble Hoodie & Jogging': 5000,
  'Ensemble T-shirt & Short': 3000,
  'Hoodie Graffiti': 3000,
  'Short Graffiti': 2399,
  'Short Print': 2000,
};

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({error: 'Method not allowed'});
  try {
    const { cart } = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    if (!Array.isArray(cart) || cart.length === 0) return res.status(400).json({error: 'Panier vide'});

    const line_items = cart.map(item => {
      const unit_amount = PRODUCTS[item.name];
      const quantity = Number(item.quantity);
      if (!unit_amount || !Number.isInteger(quantity) || quantity < 1 || quantity > 20) {
        throw new Error('Article ou quantité invalide');
      }
      return {
        price_data: {
          currency: 'eur',
          product_data: { name: `${item.name} — ${item.color} — Taille ${item.size}` },
          unit_amount,
        },
        quantity,
      };
    });

    const subtotal = line_items.reduce((sum, x) => sum + x.price_data.unit_amount * x.quantity, 0);
    const shippingAmount = subtotal >= 8000 ? 0 : 300;

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items,
      shipping_address_collection: { allowed_countries: ['FR'] },
      shipping_options: shippingAmount === 0 ? [{
        shipping_rate_data: {
          type: 'fixed_amount',
          fixed_amount: { amount: 0, currency: 'eur' },
          display_name: 'Livraison offerte',
        }
      }] : [{
        shipping_rate_data: {
          type: 'fixed_amount',
          fixed_amount: { amount: 300, currency: 'eur' },
          display_name: 'Livraison',
        }
      }],
      success_url: `${getOrigin(req)}/?paiement=succes`,
      cancel_url: `${getOrigin(req)}/?paiement=annule`,
    });

    return res.status(200).json({ url: session.url });
  } catch (e) {
    return res.status(400).json({ error: e.message || 'Erreur Stripe' });
  }
};

function getOrigin(req) {
  const proto = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  return `${proto}://${host}`;
}
