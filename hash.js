const bcrypt = require('bcryptjs');
console.log(bcrypt.hashSync('adminpassword', 10));