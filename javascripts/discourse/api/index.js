import { apiInitializer } from "discourse/lib/api";
import IdeasService from "../services/ideas-service";

export function initAPI(api) {
  const ideasService = IdeasService.create({ container: api.container });
  
  return {
    ideasService
  };
}

export default {
  name: "ideas-portal-api",
  initialize() {
    // This is just a centralized place for API code
    // The actual initialization happens in the initializer
  }
}; 