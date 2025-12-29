import {Schema, model} from 'mongoose';

const locationSchema = new Schema(
  {
    deviceId: {type: String, required: true, index: true},
    latitude: {type: Number, required: true},
    longitude: {type: Number, required: true},
    accuracy: {type: Number},
  },
  {
    timestamps: {createdAt: true, updatedAt: false},
  },
);

const Location = model('Location', locationSchema);

export default Location;

