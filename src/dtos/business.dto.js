// dtos/business.dto.js
class BusinessDto {
  constructor(business) {
    this.id = business._id;
    this.name = business.name;
    this.email = business.email;

    this.mobilePhone = business.mobilePhone;
    this.landlinePhone = business.landlinePhone;

    this.address = business.address;
    this.specialization = business.specialization;

    this.profileImage = business.profileImage;
    this.businessImages = business.businessImages || [];

    this.workingHours = business.workingHours || [];
    this.service = business.service || [];
    this.queueSettings = business.queueSettings || [];

    this.paymentMethod = business.paymentMethod;
    this.status = business.status;
    this.role = business.role;

    // IDs only (unpopulated)
    this.ourClients = business.ourClients || [];

    this.createdAt = business.createdAt;
    this.updatedAt = business.updatedAt;
  }
}

module.exports = BusinessDto;
