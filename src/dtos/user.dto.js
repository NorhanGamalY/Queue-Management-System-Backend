// dtos/user.dto.js
class UserDto {
  constructor(user) {
    this.id = user._id;
    this.name = user.name;
    this.email = user.email;
    this.phone = user.phone;
    this.role = user.role;
    this.status = user.status;
    this.profileImage = user.profileImage;
    this.locale = user.locale;

    this.businessIds = user.businessIds || [];

    this.createdAt = user.createdAt;
    this.updatedAt = user.updatedAt;
  }
}

module.exports = UserDto;
