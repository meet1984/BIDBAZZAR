# Support module

The public multipart route validates an optional JPG/PNG/PDF and enquiry fields; the service generates a reference and stores accepted attachments below `PRIVATE_UPLOAD_DIR`; the repository persists enquiry metadata. Permission-controlled admin routes list enquiries and stream attachments without exposing filesystem paths.
