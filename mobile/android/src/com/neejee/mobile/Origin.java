package com.neejee.mobile;

import java.net.URI;
import java.net.URISyntaxException;
import java.util.Set;

final class Origin {
    static final String SHOP = "https://www.neejee.com";
    static URI checked(String raw, Set<String> reviewHosts) throws URISyntaxException {
        URI url = new URI(raw.trim());
        String host = url.getHost();
        if (!"https".equalsIgnoreCase(url.getScheme()) || host == null || url.getPort() != -1 ||
                url.getRawUserInfo() != null || !(host.equals("www.neejee.com") || host.equals("neejee.com") || reviewHosts.contains(host))) {
            throw new URISyntaxException(raw, "Use an approved Neejee website link");
        }
        return url;
    }
    static String origin(URI url) {
        return "https://" + url.getHost();
    }
    private Origin() {}
}
