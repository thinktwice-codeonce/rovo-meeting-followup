import api, { route } from "@forge/api";

export const resourceTypeToContentType = (resourceType) => {
  return resourceType === 'page' ? 'page' : resourceType === 'blog' ? 'blogpost' : undefined;
}

export const determineResourceType = async (contentId) => {
  const contentType = await determineContentType(contentId);
  return contentType === 'page' ? 'page' : contentType === 'blogpost' ? 'blog' : undefined;
}

export const isPageOrBlog = (contentType) => {
  return contentType === 'page' || contentType === 'blogpost';
}

export const contentTypeToPath = (contentType) => {
  return contentType === 'page' ? 'pages' : 'blogposts';
}

const determineContentType = async (contentId) => {
  const payload = {
    contentIds: [contentId]
  }
  const response = await api.asUser().requestConfluence(route`/wiki/api/v2/content/convert-ids-to-types`, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });
  if (response.ok) {
    // console.log(`determineContentType: Response: ${response.status} ${response.statusText}`);
    const responseJson = await response.json();
    // console.log(`determineContentType: responseJson = ${responseJson}`);
    // console.log(`determineContentType: responseJson = `, responseJson);
    const contentType = responseJson && responseJson.results ? responseJson.results[contentId] : undefined;
    // console.log(`determineContentType: contentType = ${contentType}`);
    return contentType;
  } else {
    await logResponseError('determineContentType', response);
    return undefined;
  }
}

export const fetchPageOrBlogInfo = async (contentId, contentType, bodyFormat) => {
  let pageInfo = undefined;
  if (isPageOrBlog(contentType)) {
    const contentPath = contentTypeToPath(contentType);
    const response = await api.asUser().requestConfluence(route`/wiki/api/v2/${contentPath}/${contentId}?body-format=${bodyFormat}`, {
      headers: {
        'Accept': 'application/json'
      }
    });
    if (response.ok) {
      const responseJson = await response.json();
      const content = responseJson.body[bodyFormat].value;
      pageInfo = {
        title: responseJson.title,
        version: responseJson.version.number,
        content: content
      }
    } else {
      console.error(`fetchPageOrBlogInfo: Error: ${response.status} ${response.statusText}`);
    }
  } else {
    await logResponseError('fetchPageOrBlogInfo', response);
  }
  return pageInfo;
}

export const updatePageOrBlogContent = async (contentId, contentType, bodyFormat, title, version, content) => {
  // console.log(`updatePageOrBlogContent: contentId = ${contentId}`);
  // console.log(`updatePageOrBlogContent: contentType = ${contentType}`);
  // console.log(`updatePageOrBlogContent: bodyFormat = ${bodyFormat}`);
  // console.log(`updatePageOrBlogContent: title = ${title}`);
  // console.log(`updatePageOrBlogContent: version = ${version}`);
  // console.log(`updatePageOrBlogContent: content = ${JSON.stringify(content)}`);
  const contentPath = contentTypeToPath(contentType);
  const response = await api.asUser().requestConfluence(route`/wiki/api/v2/${contentPath}/${contentId}`, {
    method: 'PUT',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      id: contentId,
      status: 'draft',
      version: {
        number: 1,
        message: ''
      },
      title: title,
      type: contentType,
      body: {
        representation: bodyFormat,
        value: typeof content === 'string' ? content : JSON.stringify(content)
      }
    })
  });
  if (response.ok) {
    return await response.json();
  } else {
    await logResponseError('updatePageOrBlogContent', response);
  }
}

export const updateContentProperty = async (contentId, contentType, propertyId, key, value, version) => {
  // console.log(`updateContentProperty: contentId = ${contentId}`);
  // console.log(`updateContentProperty: contentType = ${contentType}`);
  // console.log(`updateContentProperty: propertyId = ${propertyId}`);
  // console.log(`updateContentProperty: key = ${key}`);
  // console.log(`updateContentProperty: value = ${value}`);
  // console.log(`updateContentProperty: version = ${version}`);
  const contentPath = contentTypeToPath(contentType);
  const response = await api.asUser().requestConfluence(route`/wiki/api/v2/${contentPath}/${contentId}/properties/${propertyId}`, {
    method: 'PUT',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      key: key,
      value: value,
      version: {
        number: version,
        message: ''
      }
    })
  });
  if (response.ok) {
    // console.log(`updateContentProperty: Response: ${response.status} ${response.statusText}`);
    return await response.json();
  } else {
    await logResponseError('updateContentProperty', response);
  }
}

export const createContentProperty = async (contentId, contentType, key, value) => {
  // console.log(`createContentProperty: contentId = ${contentId}`);
  // console.log(`createContentProperty: contentType = ${contentType}`);
  // console.log(`createContentProperty: key = ${key}`);
  // console.log(`createContentProperty: value = ${value}`);
  const contentPath = contentTypeToPath(contentType);
  const response = await api.asUser().requestConfluence(route`/wiki/api/v2/${contentPath}/${contentId}/properties`, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      key: key,
      value: value
    })
  });
  if (response.ok) {
    // console.log(`createContentProperty: Response: ${response.status} ${response.statusText}`);
    return await response.json();
  } else {
    await logResponseError('createContentProperty', response);
  }
}

export const getContentProperties = async (contentId, contentType) => {
  const contentPath = contentTypeToPath(contentType);
  const response = await api.asUser().requestConfluence(route`/wiki/api/v2/${contentPath}/${contentId}/properties`, {
    headers: {
      'Content-Type': 'application/json'
    }
  });
  if (response.ok) {
    // console.log(`getContentProperties: Response: ${response.status} ${response.statusText}`);
    const responseJson = await response.json();
    // console.log(`getContentProperties: responseJson: ${JSON.stringify(responseJson, null, 2)}`);
    return responseJson.results;
  } else {
    await logResponseError('getContentProperties', response);
  }
}

export const logResponseError = async (functionName, response) => {
  console.error(`${functionName}: Error: ${response.status} ${response.statusText}: ${await response.text()}`);
}
