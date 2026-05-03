import * as userService from './user.service.js';
import { sendSuccess } from '../utils/response.utils.js';

export async function getMe(req, res, next) {
  try {
    const user = await userService.getMe(req.user._id);
    return sendSuccess(res, { user });
  } catch (err) {
    next(err);
  }
}

export async function updateMe(req, res, next) {
  try {
    const user = await userService.updateMe(req.user._id, req.body);
    return sendSuccess(res, { user });
  } catch (err) {
    next(err);
  }
}
