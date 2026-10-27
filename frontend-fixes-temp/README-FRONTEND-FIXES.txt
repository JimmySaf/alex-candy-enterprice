# ALEX CANDY ENTERPRICE — frontend fixes

Replace the matching files in `frontend/src/` with the files in this ZIP:
- `App.tsx`
- `App.css`
- `products.ts` -> `frontend/src/services/products.ts`
- `product.ts` -> `frontend/src/types/product.ts`
- `index.css`
- `vite.config.ts`

Logo:
- Put the logo at `frontend/public/logo.jpeg`.
- The header and footer now use `/logo.jpeg`.

What changed:
- Adds a small “Order direct on WhatsApp” button to each product card.
- The WhatsApp message is pre-filled with the product name, price, quantity 1, and a request to confirm availability/payment.
- Displays a candy/yoghurt/ice-pop emoji if a product image fails to load.
- Resolves localhost product-image URLs against the deployed website instead of trying to load them from the visitor's own computer.

Important production image note:
If product images are uploaded through Django Admin and stored as `/media/...`, frontend changes alone cannot make those files persist on Render. The Django backend must serve media and the files need persistent/cloud storage. This ZIP improves URL handling and fallback display but does not configure Django's storage backend.
