# One export per run on AWS Lambda. Build from this folder: docker build -t model-export .
FROM public.ecr.aws/lambda/python:3.13

# Blender links against X11 and OpenGL even when it never opens a window.
RUN dnf install -y \
      libglvnd-glx libICE libSM libX11 libXext libXfixes libXi libXrender libxkbcommon \
    && dnf clean all && rm -rf /var/cache/dnf

COPY requirements.txt ${LAMBDA_TASK_ROOT}/
RUN pip install --no-cache-dir -r ${LAMBDA_TASK_ROOT}/requirements.txt

COPY convert.py handler.py ${LAMBDA_TASK_ROOT}/

# Lambda's filesystem is read-only except /tmp, and Blender writes its settings under HOME.
ENV HOME=/tmp \
    XDG_CONFIG_HOME=/tmp/.config \
    XDG_CACHE_HOME=/tmp/.cache

CMD ["handler.handler"]
