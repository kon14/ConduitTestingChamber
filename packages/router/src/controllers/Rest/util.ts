import { Request } from 'express';
import { ConduitError } from '@quintessential-sft/conduit-grpc-sdk';
import { isArray, isObject, isNil } from 'lodash';

export function extractRequestData(req: Request) {
  const context = (req as any).conduit || {};
  let params: any = {};
  let headers: any = req.headers;
  if (req.query) {
    let newObj = {};
    Object.keys(req.query).forEach((k: string) => {
      if (!req.query.hasOwnProperty(k)) return;
      // @ts-ignore
      if (!Array.isArray(req.query) && req.query[k].indexOf(',') !== -1) {
        // @ts-ignore
        newObj[k] = req.query[k].split(',');
      } else {
        // @ts-ignore
        newObj[k] = req.query[k];
      }
    });
    Object.assign(params, newObj);
  }

  if (req.body) {
    Object.assign(params, req.body);
  }

  if (req.params) {
    Object.assign(params, req.params);
  }

  if (params.populate) {
    if (params.populate.includes(',')) {
      params.populate = params.populate.split(',');
    } else if (!Array.isArray(params.populate)){
      params.populate = [params.populate];
    }
  }
  let path = req.baseUrl + req.path;
  return { context, params, headers, path };
}

export function validateParams(params: { [key: string]: any }, routeDefinedParams: { [key: string]: any }) {
  for (const key of Object.keys(routeDefinedParams)) {
    if (isArray(routeDefinedParams[key])) {
      validateArray(key, params[key], routeDefinedParams[key]);
    } else if (isObject(routeDefinedParams[key])) {
      if (routeDefinedParams[key].hasOwnProperty('type')) {
        params[key] =
          validateType(key, routeDefinedParams[key].type, params[key], routeDefinedParams[key]?.required || false);
      } else {
        validateObject(key, params[key], routeDefinedParams[key]);
      }
    } else {
      params[key] = validateType(key, routeDefinedParams[key], params[key], false);
    }
  }
}

function validateArray(
  fieldName: string,
  param: { [key: string] : any }[],
  routeDefinedArray: { [key: string] : any }[] | string[]
) {
  const type = routeDefinedArray[0];
  if (isObject(type)) {
    if (type.required && isNil(param)) {
      throw ConduitError.userInput(`${fieldName} is required`);
    }
  } else {
    if (!isArray(param)) {
      throw ConduitError.userInput(`${fieldName} must be an array`);
    }

    param.forEach((obj: any, index: number) => {
      param[index] = validateType(`${fieldName}[${index}]`, type, obj, false);
    });
  }
}

function validateObject(fieldName: string, param: { [key: string]: any }, routeDefinedObject: { [key: string]: any }) {
  if (routeDefinedObject.required && isNil(param)) {
    throw ConduitError.userInput(`${fieldName} is required`);
  } else if (isNil(param)) {
    return
  }

  if (!isObject(param) || isArray(param)) {
    throw ConduitError.userInput(`${fieldName} must be an object`);
  }
  validateParams(param, routeDefinedObject);
}

function validateType(fieldName: string, paramType: string, value: unknown, required: boolean): any {
  if (required && isNil(value)) {
    throw ConduitError.userInput(`${fieldName} is required`);
  } else if (isNil(value)) {
    return;
  }

  switch (paramType) {
    case 'String':
      if (typeof value !== 'string') throw ConduitError.userInput(`${fieldName} must be a string`);
      break;
    case 'Number':
      if (typeof value === 'string') {
        value = Number(value);
        if (Number.isNaN(value)) {
          throw ConduitError.userInput(`${fieldName} must be a number`);
        }
      } else if (typeof value !== 'number') {
        throw ConduitError.userInput(`${fieldName} must be a number`);
      }
      break;
    case 'Boolean':
      if (typeof value !== 'boolean') throw ConduitError.userInput(`${fieldName} must be a boolean`);
      break;
    case 'Date':
      break;
    case 'ObjectId':
      if (typeof value !== 'string') throw ConduitError.userInput(`${fieldName} must be a string`);
      break;
  }

  return value;
}
