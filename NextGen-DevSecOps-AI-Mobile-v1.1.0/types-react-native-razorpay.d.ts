declare module 'react-native-razorpay' {
  export type RazorpayCheckoutOptions = {
    key: string
    amount: number | string
    currency: string
    name: string
    description?: string
    image?: string
    order_id: string
    prefill?: { name?: string; email?: string; contact?: string }
    notes?: Record<string, string>
    theme?: { color?: string; backdrop_color?: string }
    modal?: { confirm_close?: boolean; escape?: boolean; handleback?: boolean; backdropclose?: boolean; ondismiss?: () => void }
  }
  const RazorpayCheckout: {
    open(options: RazorpayCheckoutOptions): Promise<{
      razorpay_payment_id: string
      razorpay_order_id: string
      razorpay_signature: string
    }>
  }
  export default RazorpayCheckout
}
