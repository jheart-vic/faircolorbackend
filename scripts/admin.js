// import mongoose from "mongoose";
// import dotenv from "dotenv";
// import User from "../models/User.js";

// dotenv.config();

// async function seedAdmin() {
//   await mongoose.connect(process.env.MONGO_URI);

//   const existing = await User.findOne({ role: "admin" });

//   if (existing) {
//     console.log("Admin already exists");
//     process.exit();
//   }

//   await User.create({
//     fullName: "Super Admin",
//     email: "admin@faircolors.com",
//     password: "faircolorAdmin@6206",
//     role: "admin",
//   });

//   console.log("Admin created");
//   process.exit();
// }

// seedAdmin();



const BookOrderModel = require("../models/bookOrder.model");
const WashAndDryModel = require("../models/washAndDry.model");
const ActivityModel = require("../models/activity.model");
const {
  ORDER_STATUS,
  ORDER_SERVICE_TYPE,
  STATION_STATUS,
  ACTIVITY_TYPE,
} = require("../util/constants");
const BaseService = require("./base.service");

// Helper — updates stage, stageHistory and stationStatus atomically
const buildStageUpdate = (status, stationStatus, note = "") => ({
  $set: {
    "stage.status":    status,
    "stage.note":      note,
    "stage.updatedAt": new Date(),
    stationStatus,
  },
  $push: {
    stageHistory: { status, note, updatedAt: new Date() },
  },
});

class WashAndDryService extends BaseService {

  // ─────────────────────────────────────────────────────────────────────────
  // DASHBOARD
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * GET DASHBOARD STATS
   * Returns counts for: Wash Queue, Active Wash, Active Dry, Completed Today
   * plus a short preview of the recent wash queue.
   * GET /wash/dashboard
   */
  async getDashboard(req) {
    try {
      const userId = req.user.id;
      const user = await WashAndDryModel.findById(userId);
      if (!user) return BaseService.sendFailedResponse({ error: "User not found" });

      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);

      const [washQueue, activeWash, activeDry, completedToday, recentQueue] = await Promise.all([
        BookOrderModel.countDocuments({ "stage.status": ORDER_STATUS.WASHING, "washDetails.startedAt": { $exists: false } }),
        BookOrderModel.countDocuments({ "stage.status": ORDER_STATUS.WASHING, "washDetails.startedAt": { $exists: true }, "washDetails.movedToDryingAt": { $exists: false } }),
        BookOrderModel.countDocuments({ "stage.status": ORDER_STATUS.DRYING }),
        BookOrderModel.countDocuments({
          "stageHistory.status": ORDER_STATUS.DRYING,
          "stageHistory.updatedAt": { $gte: startOfToday },
          "stage.status": { $nin: [ORDER_STATUS.WASHING, ORDER_STATUS.DRYING] },
        }),
        BookOrderModel.find({ "stage.status": ORDER_STATUS.WASHING, "washDetails.startedAt": { $exists: false } })
          .select("oscNumber fullName phoneNumber items serviceType serviceTier stage createdAt washDetails")
          .sort({ "stage.updatedAt": 1 })
          .limit(5)
          .lean(),
      ]);

      return BaseService.sendSuccessResponse({
        message: {
          stats: { washQueue, activeWash, activeDry, completedToday },
          recentQueue,
        },
      });
    } catch (error) {
      console.log(error);
      return BaseService.sendFailedResponse({ error: "Failed to fetch dashboard" });
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // WASH QUEUE
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * GET WASH QUEUE
   * Orders in WASHING stage that have not been started yet.
   * GET /wash/queue
   */
  async getWashQueue(req) {
    try {
      const userId = req.user.id;
      const user = await WashAndDryModel.findById(userId);
      if (!user) return BaseService.sendFailedResponse({ error: "User not found" });

      const { page = 1, limit = 20, search = "" } = req.query;
      const skip = (Number(page) - 1) * Number(limit);

      const query = {
        "stage.status": ORDER_STATUS.WASHING,
        "washDetails.startedAt": { $exists: false },
      };

      if (search) {
        query.$or = [
          { oscNumber:   { $regex: search, $options: "i" } },
          { fullName:    { $regex: search, $options: "i" } },
          { phoneNumber: { $regex: search, $options: "i" } },
        ];
      }

      const [orders, total] = await Promise.all([
        BookOrderModel.find(query)
          .select("oscNumber fullName phoneNumber items serviceType serviceTier stage stationStatus createdAt washDetails")
          .sort({ "stage.updatedAt": 1 })
          .skip(skip)
          .limit(Number(limit))
          .lean(),
        BookOrderModel.countDocuments(query),
      ]);

      const ordersWithFlags = orders.map((o) => ({
        ...o,
        flaggedItemCount: (o.items || []).filter((i) => i.flaggedForReview).length,
      }));

      return BaseService.sendSuccessResponse({
        message: {
          orders: ordersWithFlags,
          pagination: { total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / Number(limit)) },
        },
      });
    } catch (error) {
      console.log(error);
      return BaseService.sendFailedResponse({ error: "Failed to fetch wash queue" });
    }
  }

  /**
   * GET WASH QUEUE ORDER DETAILS
   * GET /wash/queue/:id
   */
  async getWashQueueOrderDetails(req) {
    try {
      const orderId = req.params.id;
      const userId  = req.user.id;

      if (!orderId) return BaseService.sendFailedResponse({ error: "Order ID is required" });

      const user = await WashAndDryModel.findById(userId);
      if (!user) return BaseService.sendFailedResponse({ error: "User not found" });

      const order = await BookOrderModel.findOne({
        _id: orderId,
        "stage.status": ORDER_STATUS.WASHING,
      }).lean();

      if (!order) return BaseService.sendFailedResponse({ error: "Order not found or not in washing stage" });

      return BaseService.sendSuccessResponse({ message: { order } });
    } catch (error) {
      console.log(error);
      return BaseService.sendFailedResponse({ error: "Failed to fetch order details" });
    }
  }

  /**
   * START WASHING
   * Operator begins washing — records startedAt and estFinishTime.
   * stationStatus → WASH_AND_DRY_STATION
   * PATCH /wash/queue/:id/start
   */
  async startWashing(req) {
    try {
      const orderId            = req.params.id;
      const userId             = req.user.id;
      const { estFinishTime }  = req.body;

      if (!orderId)      return BaseService.sendFailedResponse({ error: "Order ID is required" });
      if (!estFinishTime) return BaseService.sendFailedResponse({ error: "estFinishTime is required" });

      const user = await WashAndDryModel.findById(userId);
      if (!user) return BaseService.sendFailedResponse({ error: "User not found" });

      const order = await BookOrderModel.findOne({
        _id: orderId,
        "stage.status": ORDER_STATUS.WASHING,
        "washDetails.startedAt": { $exists: false },
      });

      if (!order) return BaseService.sendFailedResponse({ error: "Order not found, already started, or not in washing stage" });

      await BookOrderModel.updateOne(
        { _id: orderId },
        {
          $set: {
            "washDetails.startedAt":     new Date(),
            "washDetails.estFinishTime": new Date(estFinishTime),
            "washDetails.operatorId":    userId,
            stationStatus:               STATION_STATUS.WASH_AND_DRY_STATION,
          },
        }
      );

      await ActivityModel.create({
        title: "Washing Started",
        description: `Order ${order.oscNumber} has been started in the washing machine`,
        type: ACTIVITY_TYPE.ORDER_WASHING_STARTED,
      });

      return BaseService.sendSuccessResponse({ message: "Washing started successfully" });
    } catch (error) {
      console.log(error);
      return BaseService.sendFailedResponse({ error: "Failed to start washing" });
    }
  }

  /**
   * SEND ORDER TO HOLD (from wash queue)
   * stage → HOLD, stationStatus → WASH_AND_DRY_STATION
   * PATCH /wash/queue/:id/hold
   */
  async sendToHold(req) {
    try {
      const orderId    = req.params.id;
      const userId     = req.user.id;
      const { reason } = req.body;

      if (!orderId) return BaseService.sendFailedResponse({ error: "Order ID is required" });
      if (!reason)  return BaseService.sendFailedResponse({ error: "A reason is required to place order on hold" });

      const user = await WashAndDryModel.findById(userId);
      if (!user) return BaseService.sendFailedResponse({ error: "User not found" });

      const order = await BookOrderModel.findOne({ _id: orderId, "stage.status": ORDER_STATUS.WASHING });
      if (!order) return BaseService.sendFailedResponse({ error: "Order not found or not in washing stage" });

      await BookOrderModel.updateOne(
        { _id: orderId },
        buildStageUpdate(ORDER_STATUS.HOLD, STATION_STATUS.WASH_AND_DRY_STATION, reason)
      );

      await ActivityModel.create({
        title: "Order Placed on Hold",
        description: `Order ${order.oscNumber} has been placed on hold at the Wash & Dry station. Reason: ${reason}`,
        type: ACTIVITY_TYPE.ORDER_ON_HOLD,
      });

      return BaseService.sendSuccessResponse({ message: "Order placed on hold successfully" });
    } catch (error) {
      console.log(error);
      return BaseService.sendFailedResponse({ error: "Failed to place order on hold" });
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ACTIVE WASH
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * GET ACTIVE WASH
   * Orders currently being washed (startedAt set, movedToDryingAt not set).
   * GET /wash/active-wash
   */
  async getActiveWash(req) {
    try {
      const userId = req.user.id;
      const user   = await WashAndDryModel.findById(userId);
      if (!user) return BaseService.sendFailedResponse({ error: "User not found" });

      const { page = 1, limit = 20 } = req.query;
      const skip = (Number(page) - 1) * Number(limit);

      const query = {
        "stage.status": ORDER_STATUS.WASHING,
        "washDetails.startedAt":       { $exists: true },
        "washDetails.movedToDryingAt": { $exists: false },
      };

      const [orders, total] = await Promise.all([
        BookOrderModel.find(query)
          .select("oscNumber fullName phoneNumber items serviceType serviceTier stage stationStatus createdAt washDetails")
          .sort({ "washDetails.startedAt": 1 })
          .skip(skip)
          .limit(Number(limit))
          .lean(),
        BookOrderModel.countDocuments(query),
      ]);

      return BaseService.sendSuccessResponse({
        message: {
          orders,
          pagination: { total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / Number(limit)) },
        },
      });
    } catch (error) {
      console.log(error);
      return BaseService.sendFailedResponse({ error: "Failed to fetch active wash orders" });
    }
  }

  /**
   * MOVE TO DRYING
   * Operator clicks "Move to Drying".
   * stage → DRYING, stationStatus → WASH_AND_DRY_STATION (still same station)
   * PATCH /wash/active-wash/:id/move-to-drying
   */
  async moveToDrying(req) {
    try {
      const orderId = req.params.id;
      const userId  = req.user.id;

      if (!orderId) return BaseService.sendFailedResponse({ error: "Order ID is required" });

      const user = await WashAndDryModel.findById(userId);
      if (!user) return BaseService.sendFailedResponse({ error: "User not found" });

      const order = await BookOrderModel.findOne({
        _id: orderId,
        "stage.status": ORDER_STATUS.WASHING,
        "washDetails.startedAt": { $exists: true },
      });

      if (!order) return BaseService.sendFailedResponse({ error: "Order not found or not currently being washed" });

      const now = new Date();

      await BookOrderModel.updateOne(
        { _id: orderId },
        {
          ...buildStageUpdate(ORDER_STATUS.DRYING, STATION_STATUS.WASH_AND_DRY_STATION),
          $set: {
            ...buildStageUpdate(ORDER_STATUS.DRYING, STATION_STATUS.WASH_AND_DRY_STATION).$set,
            "washDetails.movedToDryingAt": now,
          },
        }
      );

      await ActivityModel.create({
        title: "Moved to Drying",
        description: `Order ${order.oscNumber} has been transferred to the dryer`,
        type: ACTIVITY_TYPE.ORDER_MOVED_TO_DRYING,
      });

      return BaseService.sendSuccessResponse({
        message: `Order ${order.oscNumber} has been transferred to the dryer`,
      });
    } catch (error) {
      console.log(error);
      return BaseService.sendFailedResponse({ error: "Failed to move order to drying" });
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ACTIVE DRY
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * GET ACTIVE DRY
   * Orders currently in DRYING stage.
   * GET /wash/active-dry
   */
  async getActiveDry(req) {
    try {
      const userId = req.user.id;
      const user   = await WashAndDryModel.findById(userId);
      if (!user) return BaseService.sendFailedResponse({ error: "User not found" });

      const { page = 1, limit = 20 } = req.query;
      const skip = (Number(page) - 1) * Number(limit);

      const query = { "stage.status": ORDER_STATUS.DRYING };

      const [orders, total] = await Promise.all([
        BookOrderModel.find(query)
          .select("oscNumber fullName phoneNumber items serviceType serviceTier stage stationStatus createdAt washDetails")
          .sort({ "washDetails.movedToDryingAt": 1 })
          .skip(skip)
          .limit(Number(limit))
          .lean(),
        BookOrderModel.countDocuments(query),
      ]);

      return BaseService.sendSuccessResponse({
        message: {
          orders,
          pagination: { total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / Number(limit)) },
        },
      });
    } catch (error) {
      console.log(error);
      return BaseService.sendFailedResponse({ error: "Failed to fetch active dry orders" });
    }
  }

  /**
   * WASH & DRY DONE — SEND TO NEXT STAGE
   * Operator clicks "Wash & Dry Done" → "Send to Ironing".
   * WASH_AND_IRON  → stage: IRONING,             stationStatus: PRESSING_AND_IRONING_STATION
   * WASHING_ONLY   → stage: READY_FOR_DELIVERY,  stationStatus: QC_STATION
   * PATCH /wash/active-dry/:id/complete
   */
  async washAndDryComplete(req) {
    try {
      const orderId = req.params.id;
      const userId  = req.user.id;

      if (!orderId) return BaseService.sendFailedResponse({ error: "Order ID is required" });

      const user = await WashAndDryModel.findById(userId);
      if (!user) return BaseService.sendFailedResponse({ error: "User not found" });

      const order = await BookOrderModel.findOne({
        _id: orderId,
        "stage.status": ORDER_STATUS.DRYING,
      });

      if (!order) return BaseService.sendFailedResponse({ error: "Order not found or not in drying stage" });

      const now = new Date();

      const isWashOnly  = order.serviceType === ORDER_SERVICE_TYPE.WASHING_ONLY;
      const nextStatus  = isWashOnly ? ORDER_STATUS.READY_FOR_DELIVERY : ORDER_STATUS.IRONING;
      const nextStation = isWashOnly ? STATION_STATUS.QC_STATION        : STATION_STATUS.PRESSING_AND_IRONING_STATION;

      await BookOrderModel.updateOne(
        { _id: orderId },
        {
          ...buildStageUpdate(nextStatus, nextStation),
          $set: {
            ...buildStageUpdate(nextStatus, nextStation).$set,
            "washDetails.dryingCompletedAt": now,
          },
        }
      );

      await ActivityModel.create({
        title: "Wash & Dry Completed",
        description: `Order ${order.oscNumber} wash and dry has been completed and sent to ${nextStatus}`,
        type: ACTIVITY_TYPE.ORDER_WASH_DRY_COMPLETED,
      });

      return BaseService.sendSuccessResponse({
        message: `Order ${order.oscNumber} has been successfully processed and sent to ${nextStatus}`,
      });
    } catch (error) {
      console.log(error);
      return BaseService.sendFailedResponse({ error: "Failed to complete wash & dry" });
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // HOLD QUEUE
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * GET HOLD QUEUE
   * GET /wash/hold
   */
  async getHoldQueue(req) {
    try {
      const userId = req.user.id;
      const user   = await WashAndDryModel.findById(userId);
      if (!user) return BaseService.sendFailedResponse({ error: "User not found" });

      const { page = 1, limit = 20, search = "" } = req.query;
      const skip = (Number(page) - 1) * Number(limit);

      const query = {
        "stage.status":  ORDER_STATUS.HOLD,
        stationStatus:   STATION_STATUS.WASH_AND_DRY_STATION,
      };

      if (search) {
        query.$or = [
          { oscNumber:   { $regex: search, $options: "i" } },
          { fullName:    { $regex: search, $options: "i" } },
          { phoneNumber: { $regex: search, $options: "i" } },
        ];
      }

      const [orders, total] = await Promise.all([
        BookOrderModel.find(query)
          .select("oscNumber fullName phoneNumber items serviceType stage stationStatus stageHistory createdAt washDetails")
          .sort({ "stage.updatedAt": -1 })
          .skip(skip)
          .limit(Number(limit))
          .lean(),
        BookOrderModel.countDocuments(query),
      ]);

      const holdItems = orders.map((order) => ({
        orderId:      order.oscNumber,
        fullName:     order.fullName,
        stage:        order.stage,
        stationStatus: order.stationStatus,
        holdReason:   order.stage.note || "",
        holdTime:     order.stage.updatedAt,
        flaggedItems: (order.items || [])
          .filter((i) => i.flaggedForReview)
          .map((i) => ({
            itemId:   i._id,
            tagId:    i.tagId,
            type:     i.type,
            flagNote: i.flagNote,
          })),
      }));

      return BaseService.sendSuccessResponse({
        message: {
          holdItems,
          pagination: { total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / Number(limit)) },
        },
      });
    } catch (error) {
      console.log(error);
      return BaseService.sendFailedResponse({ error: "Failed to fetch hold queue" });
    }
  }

  /**
   * RELEASE FROM HOLD
   * Moves order back to WASHING stage, stationStatus stays WASH_AND_DRY_STATION.
   * PATCH /wash/hold/:id/release
   */
  async releaseFromHold(req) {
    try {
      const orderId = req.params.id;
      const userId  = req.user.id;

      if (!orderId) return BaseService.sendFailedResponse({ error: "Order ID is required" });

      const user = await WashAndDryModel.findById(userId);
      if (!user) return BaseService.sendFailedResponse({ error: "User not found" });

      const order = await BookOrderModel.findOne({
        _id: orderId,
        "stage.status": ORDER_STATUS.HOLD,
        stationStatus:  STATION_STATUS.WASH_AND_DRY_STATION,
      });

      if (!order) return BaseService.sendFailedResponse({ error: "Order not found or not on hold at this station" });

      await BookOrderModel.updateOne(
        { _id: orderId },
        buildStageUpdate(ORDER_STATUS.WASHING, STATION_STATUS.WASH_AND_DRY_STATION, "Released from hold")
      );

      await ActivityModel.create({
        title: "Order Released from Hold",
        description: `Order ${order.oscNumber} has been released from hold and returned to the wash queue`,
        type: ACTIVITY_TYPE.ORDER_RELEASED_FROM_HOLD,
      });

      return BaseService.sendSuccessResponse({ message: "Order released from hold and returned to wash queue" });
    } catch (error) {
      console.log(error);
      return BaseService.sendFailedResponse({ error: "Failed to release order from hold" });
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // HISTORY
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * GET HISTORY LIST
   * GET /wash/history
   */
  async getHistoryList(req) {
    try {
      const userId = req.user.id;
      const user   = await WashAndDryModel.findById(userId);
      if (!user) return BaseService.sendFailedResponse({ error: "User not found" });

      const { page = 1, limit = 20, search = "", startDate, endDate } = req.query;
      const skip = (Number(page) - 1) * Number(limit);

      const query = {
        "stageHistory.status": ORDER_STATUS.DRYING,
        "stage.status": { $nin: [ORDER_STATUS.WASHING, ORDER_STATUS.DRYING, ORDER_STATUS.HOLD] },
      };

      if (search) {
        query.$or = [
          { oscNumber:   { $regex: search, $options: "i" } },
          { fullName:    { $regex: search, $options: "i" } },
          { phoneNumber: { $regex: search, $options: "i" } },
        ];
      }

      if (startDate || endDate) {
        query.createdAt = {};
        if (startDate) query.createdAt.$gte = new Date(startDate);
        if (endDate)   query.createdAt.$lte = new Date(endDate);
      }

      const [orders, total] = await Promise.all([
        BookOrderModel.find(query)
          .select("oscNumber fullName phoneNumber serviceType serviceTier amount stage stationStatus stageHistory washDetails createdAt updatedAt")
          .sort({ updatedAt: -1 })
          .skip(skip)
          .limit(Number(limit))
          .lean(),
        BookOrderModel.countDocuments(query),
      ]);

      return BaseService.sendSuccessResponse({
        message: {
          orders,
          pagination: { total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / Number(limit)) },
        },
      });
    } catch (error) {
      console.log(error);
      return BaseService.sendFailedResponse({ error: "Failed to fetch history" });
    }
  }

  /**
   * GET ORDER TIMELINE
   * Pipeline stepper: Intake → Tagged → Pretreated → Washed → Ironing → QC Passed → Ready → Delivered
   * GET /wash/history/:id/timeline
   */
  async getOrderTimeline(req) {
    try {
      const orderId = req.params.id;
      const userId  = req.user.id;

      if (!orderId) return BaseService.sendFailedResponse({ error: "Order ID is required" });

      const user = await WashAndDryModel.findById(userId);
      if (!user) return BaseService.sendFailedResponse({ error: "User not found" });

      const order = await BookOrderModel.findById(orderId).lean();
      if (!order) return BaseService.sendFailedResponse({ error: "Order not found" });

      const PIPELINE = [
        { key: "intake",     label: "Intake",     status: ORDER_STATUS.PENDING            },
        { key: "tagged",     label: "Tagged",     status: ORDER_STATUS.QUEUE              },
        { key: "pretreated", label: "Pretreated", status: ORDER_STATUS.SORT_AND_PRETREAT  },
        { key: "washed",     label: "Washed",     status: ORDER_STATUS.WASHING            },
        { key: "ironing",    label: "Ironing",    status: ORDER_STATUS.IRONING            },
        { key: "qc_passed",  label: "QC Passed",  status: ORDER_STATUS.QC                 },
        { key: "ready",      label: "Ready",      status: ORDER_STATUS.READY_FOR_DELIVERY },
        { key: "delivered",  label: "Delivered",  status: ORDER_STATUS.DELIVERED          },
      ];

      const stageTimestampMap = {};
      for (const entry of order.stageHistory || []) {
        if (!stageTimestampMap[entry.status]) {
          stageTimestampMap[entry.status] = entry.updatedAt;
        }
      }
      stageTimestampMap[ORDER_STATUS.PENDING] = stageTimestampMap[ORDER_STATUS.PENDING] || order.createdAt;

      const pipeline = PIPELINE.map((step) => {
        const timestamp = stageTimestampMap[step.status] || null;
        return { key: step.key, label: step.label, completed: !!timestamp, timestamp };
      });

      const trackingStatus = order.stage.status === ORDER_STATUS.DELIVERED ? "completed" : "in_progress";

      return BaseService.sendSuccessResponse({
        message: {
          order: {
            _id:            order._id,
            oscNumber:      order.oscNumber,
            fullName:       order.fullName,
            serviceType:    order.serviceType,
            serviceTier:    order.serviceTier,
            amount:         order.amount,
            stage:          order.stage,
            stationStatus:  order.stationStatus,
            trackingStatus,
            washDetails:    order.washDetails,
            createdAt:      order.createdAt,
          },
          pipeline,
        },
      });
    } catch (error) {
      console.log(error);
      return BaseService.sendFailedResponse({ error: "Failed to fetch order timeline" });
    }
  }
}

module.exports = new WashAndDryService();