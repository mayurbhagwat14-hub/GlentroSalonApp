const mongoose = require('mongoose');
const Package = require('../models/Package');
const Salon = require('../models/Salon');
const Service = require('../models/Service');
const AppSetting = require('../models/AppSetting');
const { notifyPackageStatus, notifyAdminApprovalRequest } = require('../services/notificationService');
const { processAndStoreImage, deleteImageSafe } = require('../services/imageService');
const { isDateInPast, isEndDateValid } = require('../utils/dateUtils');

const createPackage = async (req, res, next) => {
  try {
    if (isDateInPast(req.body.validFrom)) {
      return res.status(400).json({ success: false, message: 'Valid From date cannot be in the past' });
    }
    if (!isEndDateValid(req.body.validFrom, req.body.validTo)) {
      return res.status(400).json({ success: false, message: 'Valid To date cannot be earlier than Valid From date' });
    }

    const salon = await Salon.findOne({ _id: req.body.salon, vendor: req.user.id });
    if (!salon) return res.status(404).json({ success: false, message: 'Salon not found or not authorized' });

    let filename = '';
    if (req.file) {
      filename = await processAndStoreImage(req.file.buffer, 'package');
    }

    let services = req.body.services;
    if (services) {
      if (typeof services === 'string') {
        try {
          services = JSON.parse(services);
        } catch (e) {
          services = [services];
        }
      }
    }

    const pkgData = {
      ...req.body,
      services,
      image: filename,
      status: 'PENDING'
    };

    const pkg = await Package.create(pkgData);
    try { await notifyAdminApprovalRequest('package', pkg.name, req.user.name); } catch (e) {}
    res.status(201).json({ success: true, message: 'Package created. Pending admin approval.', data: pkg });
  } catch (error) { next(error); }
};

const getPackages = async (req, res, next) => {
  try {
    const {
      salon,
      status,
      isActive,
      checkValidity,
      search,
      gender,
      category,
      minPrice,
      maxPrice,
      minDiscount,
      city,
      lat,
      lng,
      sort,
      isFeatured,
      page = 1,
      limit = 20
    } = req.query;

    const query = {};

    // Default filters for public view if not specified
    if (status) {
      query.status = status;
    } else {
      query.status = 'ACTIVE';
    }

    if (isActive !== undefined) {
      query.isActive = isActive === 'true';
    } else {
      query.isActive = true;
    }

    if (checkValidity !== 'false') {
      const today = new Date();
      today.setHours(0, 0, 0, 0); // Start of today
      query.validFrom = { $lte: new Date() }; // Must have started by now
      query.validTo = { $gte: today }; // Must end today or later
    }

    if (salon) {
      query.salon = salon;
    }

    if (isFeatured !== undefined) {
      query.isFeatured = isFeatured === 'true';
    }

    // Geolocation / City filter
    let nearbySalonIds = null;
    if (lat && lng) {
      const radiusSetting = await AppSetting.findOne({ key: 'salonSearchRadius' }).lean();
      const radiusInKm = radiusSetting ? parseFloat(radiusSetting.value) : 50;
      const maxDistanceInMeters = radiusInKm * 1000;

      const salonsNearby = await Salon.find({
        isActive: true,
        isApproved: true,
        location: {
          $geoWithin: {
            $centerSphere: [
              [parseFloat(lng), parseFloat(lat)],
              maxDistanceInMeters / 6378137,
            ],
          },
        },
      }).select('_id');
      nearbySalonIds = salonsNearby.map(s => s._id);

      if (query.salon) {
        if (!nearbySalonIds.some(id => id.toString() === query.salon.toString())) {
          return res.json({ success: true, data: { packages: [], total: 0, page: parseInt(page), totalPages: 0 } });
        }
      } else {
        query.salon = { $in: nearbySalonIds };
      }
    } else if (city) {
      const salonsInCity = await Salon.find({
        city: { $regex: city, $options: 'i' },
        isActive: true,
        isApproved: true
      }).select('_id');
      const citySalonIds = salonsInCity.map(s => s._id);

      if (query.salon) {
        if (!citySalonIds.some(id => id.toString() === query.salon.toString())) {
          return res.json({ success: true, data: { packages: [], total: 0, page: parseInt(page), totalPages: 0 } });
        }
      } else {
        query.salon = { $in: citySalonIds };
      }
    }

    // Category / Gender filter (via Service)
    const serviceQueries = [];
    if (category) {
      serviceQueries.push({ category });
    }
    if (gender) {
      serviceQueries.push({ gender: gender.toLowerCase() });
    }

    if (serviceQueries.length > 0) {
      const matchingServices = await Service.find({
        $and: serviceQueries,
        isActive: true
      }).select('_id');
      const serviceIds = matchingServices.map(s => s._id);
      query.services = { $in: serviceIds };
    }

    // Price range filter
    if (minPrice || maxPrice) {
      query.discountedPrice = {};
      if (minPrice) query.discountedPrice.$gte = parseFloat(minPrice);
      if (maxPrice) query.discountedPrice.$lte = parseFloat(maxPrice);
    }

    // Discount filter
    if (minDiscount) {
      query.totalPrice = { $gt: 0 };
      const ratio = 1 - (parseFloat(minDiscount) / 100);
      query.$expr = {
        $lte: [
          { $divide: [ "$discountedPrice", "$totalPrice" ] },
          ratio
        ]
      };
    }

    // Search filter
    if (search) {
      const matchedSalons = await Salon.find({
        name: { $regex: search, $options: 'i' },
        isActive: true,
        isApproved: true
      }).select('_id');
      const matchedSalonIds = matchedSalons.map(s => s._id);

      const matchedServices = await Service.find({
        name: { $regex: search, $options: 'i' },
        isActive: true
      }).select('_id');
      const matchedServiceIds = matchedServices.map(s => s._id);

      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { salon: { $in: matchedSalonIds } },
        { services: { $in: matchedServiceIds } }
      ];
    }

    // Fetch all matching packages
    let packages = await Package.find(query)
      .populate('services', 'name price duration gender category')
      .populate('salon', 'name images address ratings city location')
      .lean();

    // Calculate discount percentages
    packages = packages.map(p => {
      const discountPercent = p.totalPrice > 0 ? Math.round(((p.totalPrice - p.discountedPrice) / p.totalPrice) * 100) : 0;
      return { ...p, discountPercent };
    });

    // Custom Sorting
    if (sort === 'price_low') {
      packages.sort((a, b) => a.discountedPrice - b.discountedPrice);
    } else if (sort === 'price_high') {
      packages.sort((a, b) => b.discountedPrice - a.discountedPrice);
    } else if (sort === 'discount_high') {
      packages.sort((a, b) => b.discountPercent - a.discountPercent);
    } else if (sort === 'rating_high') {
      packages.sort((a, b) => (b.salon?.ratings?.average || 0) - (a.salon?.ratings?.average || 0));
    } else if (sort === 'nearest' && nearbySalonIds) {
      packages.sort((a, b) => {
        const indexA = nearbySalonIds.findIndex(id => id.toString() === a.salon?._id?.toString());
        const indexB = nearbySalonIds.findIndex(id => id.toString() === b.salon?._id?.toString());
        const valA = indexA === -1 ? 999999 : indexA;
        const valB = indexB === -1 ? 999999 : indexB;
        return valA - valB;
      });
    } else {
      // Default: priority desc, then newest
      packages.sort((a, b) => {
        const prioA = a.priority || 0;
        const prioB = b.priority || 0;
        if (prioB !== prioA) return prioB - prioA;
        return new Date(b.createdAt) - new Date(a.createdAt);
      });
    }

    // Pagination
    const total = packages.length;
    const startIndex = (parseInt(page) - 1) * parseInt(limit);
    const paginatedPackages = packages.slice(startIndex, startIndex + parseInt(limit));

    res.json({
      success: true,
      data: {
        packages: paginatedPackages,
        total,
        page: parseInt(page),
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) { next(error); }
};

const getVendorPackages = async (req, res, next) => {
  try {
    const { status, search, page, limit, salon } = req.query;
    const salons = await Salon.find({ vendor: req.user.id });
    const salonIds = salons.map((s) => s._id);
    
    // If a specific salon is requested, make sure it belongs to the vendor
    let targetSalonIds = salonIds;
    if (salon) {
      if (!salonIds.some(id => id.toString() === salon.toString())) {
        return res.status(403).json({ success: false, message: 'Not authorized for this salon' });
      }
      targetSalonIds = [new mongoose.Types.ObjectId(salon)];
    }
    
    const query = { salon: { $in: targetSalonIds } };
    if (status) query.status = status;
    if (search) query.name = { $regex: search, $options: 'i' };

    if (page && limit) {
      const skip = (parseInt(page) - 1) * parseInt(limit);
      const total = await Package.countDocuments(query);
      const packages = await Package.find(query)
        .populate('services', 'name price duration')
        .populate('salon', 'name')
        .skip(skip)
        .limit(parseInt(limit));
      return res.json({
        success: true,
        data: {
          packages,
          total,
          page: parseInt(page),
          totalPages: Math.ceil(total / limit)
        }
      });
    }

    const packages = await Package.find(query).populate('services', 'name price duration').populate('salon', 'name');
    res.json({ success: true, data: packages });
  } catch (error) { next(error); }
};

const approvePackage = async (req, res, next) => {
  try {
    const pkg = await Package.findById(req.params.id).populate('salon');
    if (!pkg) return res.status(404).json({ success: false, message: 'Package not found' });
    pkg.status = 'ACTIVE';
    pkg.adminNote = req.body.adminNote || '';
    await pkg.save();
    try { await notifyPackageStatus(pkg, pkg.salon.vendor, 'ACTIVE'); } catch (e) {}
    res.json({ success: true, message: 'Package approved', data: pkg });
  } catch (error) { next(error); }
};

const rejectPackage = async (req, res, next) => {
  try {
    const pkg = await Package.findById(req.params.id).populate('salon');
    if (!pkg) return res.status(404).json({ success: false, message: 'Package not found' });
    pkg.status = 'REJECTED';
    pkg.adminNote = req.body.adminNote || '';
    await pkg.save();
    try { await notifyPackageStatus(pkg, pkg.salon.vendor, 'REJECTED'); } catch (e) {}
    res.json({ success: true, message: 'Package rejected', data: pkg });
  } catch (error) { next(error); }
};

const updatePackage = async (req, res, next) => {
  try {
    const pkg = await Package.findById(req.params.id).populate('salon');
    if (!pkg) return res.status(404).json({ success: false, message: 'Package not found' });
    if (pkg.salon.vendor.toString() !== req.user.id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    if (req.body.validFrom && new Date(req.body.validFrom).toISOString().split('T')[0] !== new Date(pkg.validFrom).toISOString().split('T')[0]) {
      if (isDateInPast(req.body.validFrom)) {
        return res.status(400).json({ success: false, message: 'Valid From date cannot be changed to a past date' });
      }
    }

    const validFromToUse = req.body.validFrom || pkg.validFrom;
    const validToToUse = req.body.validTo || pkg.validTo;

    if (!isEndDateValid(validFromToUse, validToToUse)) {
      return res.status(400).json({ success: false, message: 'Valid To date cannot be earlier than Valid From date' });
    }

    let services = req.body.services;
    if (services) {
      if (typeof services === 'string') {
        try {
          services = JSON.parse(services);
        } catch (e) {
          services = [services];
        }
      }
    }

    let oldImage = pkg.image;
    let newImage = null;

    if (req.file) {
      newImage = await processAndStoreImage(req.file.buffer, 'package');
    }

    const updateData = {
      ...req.body,
      status: 'PENDING' // Reset to pending approval on update
    };
    if (services) updateData.services = services;
    if (newImage) updateData.image = newImage;

    const updated = await Package.findByIdAndUpdate(req.params.id, updateData, { new: true });

    if (newImage && oldImage) {
      deleteImageSafe(oldImage);
    }

    res.json({ success: true, message: 'Package updated. Pending admin re-approval.', data: updated });
  } catch (error) { next(error); }
};

const deletePackage = async (req, res, next) => {
  try {
    const pkg = await Package.findById(req.params.id).populate('salon');
    if (!pkg) return res.status(404).json({ success: false, message: 'Package not found' });
    if (pkg.salon.vendor.toString() !== req.user.id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }
    await Package.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Package deleted' });
  } catch (error) { next(error); }
};

const togglePackageStatus = async (req, res, next) => {
  try {
    const pkg = await Package.findById(req.params.id).populate('salon');
    if (!pkg) return res.status(404).json({ success: false, message: 'Package not found' });
    if (pkg.salon.vendor.toString() !== req.user.id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }
    pkg.isActive = !pkg.isActive;
    await pkg.save();
    res.json({ success: true, message: `Package ${pkg.isActive ? 'activated' : 'deactivated'}`, data: pkg });
  } catch (error) { next(error); }
};

const updatePackageAdmin = async (req, res, next) => {
  try {
    const { isFeatured, priority, isActive, status, validFrom, validTo, adminNote } = req.body;
    const pkg = await Package.findById(req.params.id);
    if (!pkg) return res.status(404).json({ success: false, message: 'Package not found' });

    if (isFeatured !== undefined) {
      if (isFeatured && status !== 'ACTIVE' && pkg.status !== 'ACTIVE') {
        return res.status(400).json({ success: false, message: 'Only approved offers can be featured' });
      }
      pkg.isFeatured = isFeatured;
    }
    if (priority !== undefined) pkg.priority = parseInt(priority);
    if (isActive !== undefined) pkg.isActive = isActive;
    
    if (status !== undefined) {
      pkg.status = status;
      // If unapproved or rejected, automatically remove from featured
      if (status === 'REJECTED' || status === 'PENDING') {
        pkg.isFeatured = false;
      }
    }
    
    if (validFrom !== undefined) pkg.validFrom = new Date(validFrom);
    if (validTo !== undefined) pkg.validTo = new Date(validTo);
    if (adminNote !== undefined) pkg.adminNote = adminNote;

    await pkg.save();
    res.json({ success: true, message: 'Package settings updated successfully', data: pkg });
  } catch (error) { next(error); }
};

const deletePackageAdmin = async (req, res, next) => {
  try {
    const pkg = await Package.findById(req.params.id);
    if (!pkg) return res.status(404).json({ success: false, message: 'Package not found' });
    let oldImage = pkg.image;
    await Package.findByIdAndDelete(req.params.id);
    if (oldImage) {
      deleteImageSafe(oldImage);
    }
    res.json({ success: true, message: 'Package deleted successfully' });
  } catch (error) { next(error); }
};

module.exports = { 
  createPackage, 
  getPackages, 
  getVendorPackages, 
  approvePackage, 
  rejectPackage, 
  updatePackage, 
  deletePackage, 
  togglePackageStatus,
  updatePackageAdmin,
  deletePackageAdmin
};
