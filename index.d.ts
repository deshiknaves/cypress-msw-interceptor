import type { MockedRequest } from 'msw';

declare global {
  namespace Cypress {
    interface Chainable<Subject = any> {
      waitForRequest(alias: string): Chainable<{ id: string; request: MockedRequest; complete: boolean }>;
      waitForQuery(alias: string): Chainable<{ id: string; request: MockedRequest; complete: boolean }>;
      waitForMutation(alias: string): Chainable<{ id: string; request: MockedRequest; complete: boolean }>;
      getRequestCalls(alias: string): Chainable<void>;
      getQueryCalls(alias: string): Chainable<void>;
      getMutationCalls(alias: string): Chainable<void>;
      interceptRequest(type, route, ...args): Chainable<string>;
      interceptQuery(name, ...args): Chainable<string>;
      interceptMutation(name, ...args): Chainable<string>;
      interceptMswRequest(
        type: string,
        route: string,
        alias: string,
        config?: {
          isEnabled?: boolean;
          responseStatus?: number;
          responseName?: string;
          delay?: number;
        }
      ): Chainable<string>;
    }
  }
}
