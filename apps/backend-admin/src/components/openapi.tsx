/* eslint-disable no-console */
import { useEffect, useState, useCallback } from "react";
import SwaggerUI from "swagger-ui-react";
import "swagger-ui-react/swagger-ui.css";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/authentication";

export function OpenAPI() {
  const { t } = useTranslation();
  const { isAuthenticated, getAccessToken } = useAuth();
  const [token, setToken] = useState<string | null>(null);
  const url = import.meta.env.BASE_URL.endsWith("/")
    ? import.meta.env.BASE_URL + "openapi.json"
    : import.meta.env.BASE_URL + "/openapi.json";

  /**
   * If user is authenticated, set the token 
   */
  useEffect(() => {
    if (isAuthenticated) {
      getAccessToken().then((token) => {
        setToken(token);
      });
    } else {
      setToken(null);
    }
  }, [isAuthenticated, getAccessToken]);

  // Fetch the OpenAPI spec from the server
  const [openApiSpec, setOpenApiSpec] = useState(null);

  useEffect(() => {
    fetch(url)
      .then((response) => response.json())
      .then((data) => {
        data.servers = [
          {
            url: import.meta.env.API_BASE_URL.endsWith("/api")
              ? import.meta.env.API_BASE_URL.split("/api")[0]
              : import.meta.env.API_BASE_URL,
            description: t("api-server"),
          },
        ];
        setOpenApiSpec(data);
      })
      .catch((error) => console.error("Error fetching OpenAPI spec:", error));
  }, [url, t]);

  // Callback when SwaggerUI is ready
  const [swaggerUIInstance, setSwaggerUIInstance] = useState<any>(null);

  const onComplete = useCallback((instance: any) => {
    console.log("SwaggerUI instance ready");
    setSwaggerUIInstance(instance);
  }, []);

  // Effect to set authorization when token or SwaggerUI instance changes
  useEffect(() => {
    if (token && swaggerUIInstance) {
      console.log("Setting bearer token:", token);
      swaggerUIInstance.preauthorizeApiKey("bearerAuth", token);
    }
  }, [token, swaggerUIInstance]);

  return (
    <SwaggerUI
      spec={openApiSpec as unknown as Object}
      onComplete={onComplete}
    />
  );
}
