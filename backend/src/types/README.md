# Type augmentation

`express.d.ts` adds the verified authenticated user payload to Express requests. Authentication middleware writes it and protected controllers consume it. Keep declaration augmentation here and application models in their owning modules.
