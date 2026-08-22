# Feature modules

Each subfolder owns one business capability and normally contains routes, controller, schemas, service, and repository. Requests flow inward from Express to MySQL, and repositories do not call services. Cross-module composition is allowed in dashboard services; core domain rules remain with the owning service.
