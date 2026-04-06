export function generatePublicId(prefix) {
  const random = Math.random().toString(36).substring(2, 7).toUpperCase();
  const timestamp = Date.now().toString(36).toUpperCase();

  return `${prefix}-${random}${timestamp.slice(-3)}`;
}


export function formatCustomer(customer) {
  return {
    id: customer._id,
    publicId: customer.publicId,
    fullName: customer.fullName,
    phone: customer.phone,
    address: customer.address,
    status: customer.status,
    createdBy: customer.createdBy
      ? {
          id: customer.createdBy._id,
          fullName: customer.createdBy.fullName,
          email: customer.createdBy.email,
          publicId: customer.createdBy.publicId,
        }
      : null,
      assignedTo: customer.assignedTo
      ? {
          id: customer.assignedTo._id,
          fullName: customer.assignedTo.fullName,
          email: customer.assignedTo.email,
          publicId: customer.assignedTo.publicId,
        }
      : null,
  };
}
export function formatTransaction(transaction) {
  return {
    type: transaction.type,
    amount: transaction.amount,
    status: transaction.status,
    publicId: transaction.publicId,
    customerId: transaction.customerId
      ? {
          fullName: transaction.customerId.fullName,
          email: transaction.customerId.email,
          publicId: transaction.customerId.publicId,
        }
      : null,
      cashierId: transaction.cashierId
      ? {
          fullName: transaction.cashierId.fullName,
          email: transaction.cashierId.email,
          publicId: transaction.cashierId.publicId,
        }
      : null,
  };
}
