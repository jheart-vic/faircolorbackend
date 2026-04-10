export function generatePublicId(prefix) {
  const random = Math.random().toString(36).substring(2, 7).toUpperCase();
  const timestamp = Date.now().toString(36).toUpperCase();

  return `${prefix}-${random}${timestamp.slice(-3)}`;
}


export function formatCustomer(customer) {
    return {
        id: customer._id,
        publicId: customer.publicId,
        title: customer.title,
        fullName: customer.fullName,
        surname: customer.surname,
        otherName: customer.otherName,
        gender: customer.gender,
        maritalStatus: customer.maritalStatus,
        dateOfBirth: customer.dateOfBirth,
        nationality: customer.nationality,
        bvn: customer.bvn,
        nin: customer.nin,
        meansOfIdentification: customer.meansOfIdentification,
        phone: customer.phone,
        email: customer.email,
        address: customer.address,
        businessAddress: customer.businessAddress,
        occupation: customer.occupation,
        employerName: customer.employerName,
        employerAddress: customer.employerAddress,
        bankName: customer.bankName,
        accountName: customer.accountName,
        accountNumber: customer.accountNumber,
        nextOfKin: customer.nextOfKin ?? null,
        emergencyContact: customer.emergencyContact ?? null,
        guarantor: customer.guarantor ?? null,
        status: customer.status,
        isApproved:customer.isApproved,
        createdAt: customer.createdAt,
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
        approvedBy: customer.approvedBy
            ? {
                id: customer.approvedBy._id,
                fullName: customer.approvedBy.fullName,
                publicId: customer.approvedBy.publicId,
            }
            : null,
    }
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
                surname: transaction.customerId.surname,
                otherName: transaction.customerId.otherName,
                phone: transaction.customerId.phone,
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
    }
}
