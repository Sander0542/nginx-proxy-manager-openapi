const {
  default: convert,
} = require("@openapi-contrib/json-schema-to-openapi-schema");
const fs = require("fs");

const pathInfos = {
  "/tokens": {
    single: "Token",
    plural: "Tokens",
  },
  "/users": {
    single: "User",
    plural: "Users",
  },
  "/settings": {
    single: "Setting",
    plural: "Settings",
    idType: "string",
  },
  "/nginx/proxy-hosts": {
    single: "ProxyHost",
    plural: "ProxyHosts",
  },
  "/nginx/redirection-hosts": {
    single: "RedirectionHost",
    plural: "RedirectionHosts",
  },
  "/nginx/dead-hosts": {
    single: "DeadHost",
    plural: "DeadHosts",
  },
  "/nginx/streams": {
    single: "Stream",
    plural: "Streams",
  },
  "/nginx/certificates": {
    single: "Certificate",
    plural: "Certificates",
  },
  "/nginx/access-lists": {
    single: "AccessList",
    plural: "AccessLists",
  },
};

const getPathInfo = (path) => {
  return pathInfos[
    Object.keys(pathInfos).filter((key) => path.startsWith(key))[0]
  ];
};

const titleToPascal = (title) => {
  return title.replaceAll(" ", "");
};

const generate = async () => {
  const data = fs.readFileSync("index.json", "utf8");
  const schema = JSON.parse(data);

  const convertedSchema = await convert(schema, {
    dereference: true,
  });

  var paths = Object.values(convertedSchema.properties).reduce(
    (items, item) => {
      return items.concat(item["x-links"]);
    },
    []
  );
  paths = paths.reduce((items, item) => {
    if (item.title === "List" && item.method === "GET") {
      getItem = {
        ...item,
        title: "Get",
        method: "GET",
        description: item.description.replace("list of", "").slice(0, -1),
        href: `${item.href}/{definitions.identity.example}`,
        targetSchema: {
          type: "object",
          properties: item.targetSchema.items,
        },
      };
      listItem = {
        ...item,
        getRouteTitle: getItem.title,
      };
      items.push(getItem);
      items.push(listItem);
    } else {
      items.push(item);
    }
    return items;
  }, []);

  const componentSchemas = {
    HealthResponse: {
      type: "object",
      description: "Health object",
      additionalProperties: false,
      required: ["status", "version"],
      properties: {
        status: {
          type: "string",
          description: "Healthy",
          example: "OK",
        },
        version: {
          type: "object",
          description: "The version object",
          example: {
            major: 2,
            minor: 0,
            revision: 0,
          },
          additionalProperties: false,
          required: ["major", "minor", "revision"],
          properties: {
            major: {
              type: "integer",
              minimum: 0,
            },
            minor: {
              type: "integer",
              minimum: 0,
            },
            revision: {
              type: "integer",
              minimum: 0,
            },
          },
        },
      },
    },
  };
  const requestBodies = {};

  var groupedPaths = paths.reduce((grouping, path) => {
    const pathName = path.href.replace(
      "{definitions.identity.example}",
      "{id}"
    );
    const titlePascal = titleToPascal(path.title);
    const pathInfo = getPathInfo(path.href);

    const routeSpec = {
      operationId: path.method.toLowerCase() + pathInfo.single + titlePascal,
      summary: path.description,
      tags: [pathInfo.plural],
      responses: {
        200: {
          description: "200 response",
        },
      },
    };

    if (path.targetSchema) {
      const componentSchemaName = pathInfo.single + titlePascal + "Response";

      if (path.targetSchema.type === "array") {
        let items = {
          type: "object",
          properties: path.targetSchema.items,
        };
        if (path.getRouteTitle) {
          items = {
            $ref: `#/components/schemas/${
              pathInfo.single +
              titleToPascal(path.getRouteTitle) +
              "Response"
            }`,
          };
        }

        path.targetSchema = {
          ...path.targetSchema,
          items,
        };
      }

      routeSpec.responses = {
        ...routeSpec.responses,
        200: {
          description: "200 response",
          content: {
            "application/json": {
              schema: {
                $ref: `#/components/schemas/${componentSchemaName}`,
              },
            },
          },
        },
      };

      componentSchemas[componentSchemaName] = path.targetSchema;
    }

    if (path.schema && path.method !== "GET") {
      const requestBodyName = pathInfo.single + titlePascal + "Request";

      routeSpec.requestBody = {
        description: "Request body",
        $ref: `#/components/requestBodies/${requestBodyName}`,
      };

      requestBodies[requestBodyName] = {
        content: {
          "application/json": {
            schema: path.schema,
          },
        },
      };
    }

    if (path.access === "private") {
      routeSpec.security = [
        {
          BearerAuth: ["users"],
        },
        ...(routeSpec.security ?? []),
      ];
    }

    if (pathName.includes("{id}")) {
      routeSpec.parameters = [
        {
          name: "id",
          in: "path",
          required: true,
          schema: {
            type: pathInfo.idType ?? "integer",
          },
        },
        ...(routeSpec.parameters ?? []),
      ];
    }

    grouping[pathName] = grouping[pathName] || {};
    grouping[pathName][path.method.toLowerCase()] = routeSpec;
    return grouping;
  }, {});

  const swagger = {
    openapi: "3.0.0",
    info: {
      title: "Nginx Proxy Manager API",
      version: "2.x.x",
    },
    servers: [
      {
        url: "{url}/api",
        variables: {
          url: {
            default: "http://localhost:81",
          },
        },
      },
    ],
    paths: {
      "/": {
        get: {
          operationId: "health",
          summary: "Returns the API health status.",
          responses: {
            200: {
              description: "200 response",
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/HealthResponse",
                  },
                },
              },
            },
          },
        },
      },
      ...groupedPaths,
    },
    components: {
      securitySchemes: {
        BearerAuth: {
          type: "http",
          scheme: "bearer",
        },
      },
      schemas: Object.keys(componentSchemas)
        .sort()
        .reduce((items, key) => {
          items[key] = componentSchemas[key];
          return items;
        }, {}),
      requestBodies: Object.keys(requestBodies)
        .sort()
        .reduce((items, key) => {
          items[key] = requestBodies[key];
          return items;
        }, {}),
    },
  };

  fs.writeFileSync("api.swagger.json", JSON.stringify(swagger, null, 2));
};

generate();
