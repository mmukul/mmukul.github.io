# NextGen DevSecOps AI Mobile v1.1.0

## Validated payment and mobile security update
- Retains the v1.1.0 Home, Courses, Demo Session and Let's Connect experience with compact mobile spacing.
- Retains the Home version badge and SEO/ASO positioning for DevOps, DevSecOps, AppSec, Generative AI and AI Security training.
- ENROLL NOW uses the secure Razorpay order and server-side verification flow for all four courses; course/demo actions are kept separate.
- Payment WebView isolates the checkout view so general website content is not exposed behind the payment screen.
- Razorpay checkout is no longer forced into a browser-side payment-method configuration; the server/Razorpay Checkout configuration controls available methods, reducing WebView checkout conflicts.
- Payment navigation is restricted to the website, Razorpay and required Cloudflare Turnstile origins.
- Payment uses the native Razorpay React Native SDK for reliable Android UPI/card checkout; the existing server-side order creation and payment-signature verification remain in place.
- Student Login, Demo Session and Let's Connect Turnstile use a compact, scaled widget bounded to the available mobile width.
- WebViews disable mixed content and local file access; external navigation is allowlisted.
- Cloudflare Turnstile network allowlisting includes current challenge subdomains required by Cloudflare.
- Existing EAS project ID remains removed from app configuration as requested.

## Version
- App version: 1.1.0
- Android versionCode: 10
- Package: `in.nextgendevsecops.app`

- Website validation: course names, fees and curriculum mapping were checked against the v1.1.0 website source; the per-course Demo CTA inside the course enrollment modal is removed so Demo remains a separate action.


## v1.1.0 UI & SEO alignment

- Mobile palette aligned with the NextGen DevSecOps AI website: dark navy, cyan, blue and violet.
- Demo Session CTA uses the premium blue/violet visual language.
- Primary, secondary, enrolment, payment, contact and navigation buttons use a consistent hierarchy.
- Student Login, payment, Connect, Courses, Services, About and YouTube pages use the same visual system.
- Web export metadata includes SEO title, description, keywords, Open Graph/Twitter metadata, canonical URL and SoftwareApplication structured data for the Android release.
