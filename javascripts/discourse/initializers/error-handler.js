// import { apiInitializer } from "discourse/lib/api";

// export default apiInitializer("0.11.1", (api) => {
//   // Add a global error handler to suppress specific errors in the console
//   const originalError = console.error;
//   console.error = function(...args) {
//     // Check if this is the specific error we want to suppress
//     if (args.length > 0 && 
//         typeof args[0] === 'object' && 
//         args[0] !== null &&
//         args[0].toString && 
//         args[0].toString().includes("Cannot read properties of undefined (reading 'id')")) {
//       // Suppress this specific error
//       return;
//     }
    
//     // Call the original console.error for all other errors
//     originalError.apply(console, args);
//   };

//   // Ensure we restore the original error handler on cleanup
//   api.cleanupStream(() => {
//     console.error = originalError;
//   });
// });
