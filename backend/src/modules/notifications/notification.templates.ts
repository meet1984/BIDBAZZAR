function baseEmail(title: string, bodyContent: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #1e293b; margin: 0; padding: 24px; }
    .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; padding: 32px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
    .header { border-bottom: 1px solid #f1f5f9; padding-bottom: 20px; margin-bottom: 24px; }
    .brand { font-size: 22px; font-weight: 700; color: #0f172a; text-decoration: none; letter-spacing: -0.5px; }
    .brand span { color: #f59e0b; }
    .title { font-size: 20px; font-weight: 600; color: #0f172a; margin-bottom: 16px; }
    .content { font-size: 15px; line-height: 1.6; color: #334155; }
    .highlight-box { background: #f8fafc; border-left: 4px solid #f59e0b; padding: 16px; border-radius: 6px; margin: 20px 0; }
    .footer { margin-top: 32px; padding-top: 20px; border-top: 1px solid #f1f5f9; font-size: 13px; color: #94a3b8; text-align: center; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="brand">BID<span>MYLOT</span></div>
    </div>
    <div class="content">
      <div class="title">${title}</div>
      ${bodyContent}
    </div>
    <div class="footer">
      &copy; ${new Date().getFullYear()} BidMyLot Marketplace. All rights reserved.
    </div>
  </div>
</body>
</html>`;
}

function escapeHtml(value: unknown): string {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export const notificationTemplates = {
  orderCreated(orderRef: string, totalAmount: number, currency: string, isBuyer: boolean) {
    const title = "Deal Confirmed";
    const message = isBuyer
      ? `Your deal ${orderRef} for ${currency} ${totalAmount.toLocaleString()} is confirmed. You can now contact the seller directly from the Order Centre.`
      : `Your deal ${orderRef} for ${currency} ${totalAmount.toLocaleString()} is confirmed. You can now contact the buyer directly from the Order Centre.`;

    const html = baseEmail(
      title,
      `<p>${escapeHtml(message)}</p>
       <div class="highlight-box">
         <strong>Order Reference:</strong> ${escapeHtml(orderRef)}<br>
         <strong>Total Amount:</strong> ${escapeHtml(currency)} ${totalAmount.toLocaleString()}
       </div>`,
    );

    return { title, message, html };
  },

  orderCompleted(orderRef: string, isBuyer: boolean) {
    const title = "Order Completed";
    const message = isBuyer
      ? `Order ${orderRef} has been successfully completed. Please take a moment to leave a review for the seller.`
      : `Order ${orderRef} is now completed. Please take a moment to leave a review for the buyer.`;

    const html = baseEmail(
      title,
      `<p>${escapeHtml(message)}</p>
       <div class="highlight-box">
         <strong>Order Reference:</strong> ${escapeHtml(orderRef)}<br>
         <strong>Status:</strong> Completed
       </div>`,
    );

    return { title, message, html };
  },

  disputeOpened(orderRef: string, disputeRef: string, reason: string, isOpener: boolean) {
    const title = isOpener ? "Dispute Opened" : "Dispute Filed on Order";
    const message = isOpener
      ? `Your dispute (${disputeRef}) for order ${orderRef} has been submitted and is under compliance review.`
      : `A dispute (${disputeRef}) was opened for order ${orderRef} for reason: "${reason}". The deal is paused for review.`;

    const html = baseEmail(
      title,
      `<p>${escapeHtml(message)}</p>
       <div class="highlight-box">
         <strong>Dispute Reference:</strong> ${escapeHtml(disputeRef)}<br>
         <strong>Order:</strong> ${escapeHtml(orderRef)}<br>
         <strong>Reason:</strong> ${escapeHtml(reason)}
       </div>`,
    );

    return { title, message, html };
  },

  disputeResolved(orderRef: string, disputeRef: string, outcome: string) {
    const title = "Dispute Resolved";
    const message = `Dispute ${disputeRef} for order ${orderRef} has been resolved by admin compliance (${outcome.replace(/_/g, " ")}).`;

    const html = baseEmail(
      title,
      `<p>${escapeHtml(message)}</p>
       <div class="highlight-box">
         <strong>Dispute Reference:</strong> ${escapeHtml(disputeRef)}<br>
         <strong>Outcome:</strong> ${escapeHtml(outcome.replace(/_/g, " ").toUpperCase())}
       </div>`,
    );

    return { title, message, html };
  },

  reviewReceived(reviewerName: string, ratingScore: number) {
    const title = "New Review Received";
    const message = `You received a ${ratingScore}-star review from ${reviewerName}.`;

    const html = baseEmail(
      title,
      `<p>${escapeHtml(message)}</p>
       <div class="highlight-box">
         <strong>Rating:</strong> ${ratingScore} / 5 Stars<br>
         <strong>Reviewer:</strong> ${escapeHtml(reviewerName)}
       </div>`,
    );

    return { title, message, html };
  },

  offerAcceptedBuyer(listingTitle: string, lotReference: string, amount: number, currency: string, deadlineHours: number) {
    const title = "🎉 Your Offer Has Been Accepted!";
    const message = `Great news! The seller has selected and accepted your offer of ${currency} ${amount.toLocaleString()} for "${listingTitle}" (${lotReference}). Please confirm your purchase within ${deadlineHours} hours to finalize the deal.`;

    const html = baseEmail(
      title,
      `<p>${escapeHtml(message)}</p>
       <div class="highlight-box">
         <strong>Lot Reference:</strong> ${escapeHtml(lotReference)}<br>
         <strong>Listing:</strong> ${escapeHtml(listingTitle)}<br>
         <strong>Accepted Price:</strong> ${escapeHtml(currency)} ${amount.toLocaleString()}<br>
         <strong>Confirmation Window:</strong> ${deadlineHours} Hours
       </div>
       <p>Please log in to your BidMyLot dashboard to confirm your purchase and view seller contact details for direct settlement.</p>`,
    );

    return { title, message, html };
  },

  offerAcceptedSeller(listingTitle: string, lotReference: string, buyerName: string, amount: number, currency: string) {
    const title = "Offer Selection Confirmed";
    const message = `You have accepted the offer from ${buyerName} for ${currency} ${amount.toLocaleString()} on "${listingTitle}" (${lotReference}). The buyer has been notified to confirm purchase.`;

    const html = baseEmail(
      title,
      `<p>${escapeHtml(message)}</p>
       <div class="highlight-box">
         <strong>Lot Reference:</strong> ${escapeHtml(lotReference)}<br>
         <strong>Listing:</strong> ${escapeHtml(listingTitle)}<br>
         <strong>Selected Buyer:</strong> ${escapeHtml(buyerName)}<br>
         <strong>Agreed Price:</strong> ${escapeHtml(currency)} ${amount.toLocaleString()}
       </div>
       <p>Once the buyer confirms, your contact cards will be exchanged in the Order Centre so you can coordinate directly.</p>`,
    );

    return { title, message, html };
  },

  offerUnsuccessful(listingTitle: string, lotReference: string) {
    const title = `Update on Your Offer for ${lotReference}`;
    const message = `The seller has selected another offer for "${listingTitle}" (${lotReference}). Your offer was not chosen for this lot. Thank you for your interest and participation.`;

    const html = baseEmail(
      title,
      `<p>${escapeHtml(message)}</p>
       <div class="highlight-box">
         <strong>Lot Reference:</strong> ${escapeHtml(lotReference)}<br>
         <strong>Listing:</strong> ${escapeHtml(listingTitle)}<br>
         <strong>Status:</strong> Not Selected (Another offer accepted)
       </div>
       <p>Browse our marketplace to find more active listings and submit offers on available lots.</p>`,
    );

    return { title, message, html };
  },

  allocationAcceptedBuyer(listingTitle: string, lotReference: string, quantity: number, unitPrice: number, currency: string) {
    const title = "📦 Wholesale Units Allocated to You!";
    const total = quantity * unitPrice;
    const message = `The seller has allocated ${quantity} units of "${listingTitle}" (${lotReference}) to you at ${currency} ${unitPrice.toLocaleString()}/unit (Total: ${currency} ${total.toLocaleString()}).`;

    const html = baseEmail(
      title,
      `<p>${escapeHtml(message)}</p>
       <div class="highlight-box">
         <strong>Lot Reference:</strong> ${escapeHtml(lotReference)}<br>
         <strong>Listing:</strong> ${escapeHtml(listingTitle)}<br>
         <strong>Allocated Quantity:</strong> ${quantity} units<br>
         <strong>Unit Price:</strong> ${escapeHtml(currency)} ${unitPrice.toLocaleString()}<br>
         <strong>Total Deal Value:</strong> ${escapeHtml(currency)} ${total.toLocaleString()}
       </div>
       <p>Please log in to your dashboard to confirm this allocation.</p>`,
    );

    return { title, message, html };
  },

  allocationAcceptedSeller(listingTitle: string, lotReference: string, buyerName: string, quantity: number, unitPrice: number, currency: string) {
    const title = "Wholesale Allocation Confirmed";
    const total = quantity * unitPrice;
    const message = `You have allocated ${quantity} units of "${listingTitle}" (${lotReference}) to ${buyerName} at ${currency} ${unitPrice.toLocaleString()}/unit (Total: ${currency} ${total.toLocaleString()}).`;

    const html = baseEmail(
      title,
      `<p>${escapeHtml(message)}</p>
       <div class="highlight-box">
         <strong>Lot Reference:</strong> ${escapeHtml(lotReference)}<br>
         <strong>Listing:</strong> ${escapeHtml(listingTitle)}<br>
         <strong>Buyer:</strong> ${escapeHtml(buyerName)}<br>
         <strong>Allocated Quantity:</strong> ${quantity} units<br>
         <strong>Unit Price:</strong> ${escapeHtml(currency)} ${unitPrice.toLocaleString()}<br>
         <strong>Total Value:</strong> ${escapeHtml(currency)} ${total.toLocaleString()}
       </div>`,
    );

    return { title, message, html };
  },
};
